const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { spawn, execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { once } = require('node:events');
const { readFileSync } = require('node:fs');
const { createServer } = require('node:net');
const { setTimeout: delay } = require('node:timers/promises');
const { parse } = require('dotenv');
const { Client } = require('pg');
const Redis = require('ioredis');
const Bull = require('bull');
const { JwtService } = require('@nestjs/jwt');
const amqp = require('amqplib');
const runFile = promisify(execFile);
const readme = readFileSync('README.md', 'utf8');

function exampleBody(heading) {
  const section = readme.slice(readme.indexOf(heading));
  const block = /```\s*bash\s*\n([\s\S]*?)```/.exec(section);
  const payload = block && /-d\s+'([\s\S]*?)'/.exec(block[1]);
  assert.ok(payload, `README must contain a JSON curl body under ${heading}`);
  return JSON.parse(payload[1]);
}

async function stop(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
  await exited;
  clearTimeout(timer);
}

async function scanKeys(redis, prefix) {
  let cursor = '0';
  const keys = [];
  do {
    const [next, found] = await redis.scan(
      cursor,
      'MATCH',
      `${prefix}:*`,
      'COUNT',
      100,
    );
    cursor = next;
    keys.push(...found);
  } while (cursor !== '0');
  return keys;
}

test('gateway HTTP → RabbitMQ → services', { timeout: 180000 }, async (t) => {
  const userEnv = {
    ...parse(readFileSync('apps/user-service/.env')),
    ...process.env,
  };
  const catalogEnv = {
    ...parse(readFileSync('apps/catalog-service/.env')),
    ...process.env,
  };
  const suffix = randomUUID().replaceAll('-', '');
  const userDb = `gateway_users_test_${suffix}`;
  const catalogDb = `gateway_catalog_test_${suffix}`;
  const userQueue = `gateway_users_test_${suffix}`;
  const catalogQueue = `gateway_catalog_test_${suffix}`;
  const catalogExchange = `gateway_catalog_exchange_${suffix}`;
  const catalogDlx = `gateway_catalog_dlx_${suffix}`;
  const catalogDlq = `gateway_catalog_dlq_${suffix}`;
  const catalogEventExchange = `gateway_catalog_events_${suffix}`;
  const notificationQueue = `gateway_notifications_${suffix}`;
  const notificationRetryExchange = `gateway_notification_retry_${suffix}`;
  const notificationRetryQueue = `gateway_notification_retry_queue_${suffix}`;
  const notificationDlx = `gateway_notification_dlx_${suffix}`;
  const notificationDlq = `gateway_notification_dlq_${suffix}`;
  const cachePrefix = `gateway_cache_test_${suffix}`;
  const bullPrefix = `gateway_bull_test_${suffix}`;
  const processes = [];
  const createdDatabases = [];
  const createdQueues = [];
  const dbOptions = {
    host: userEnv.DB_HOST,
    port: Number(userEnv.DB_PORT || 5434),
    user: userEnv.DB_USERNAME,
    password: userEnv.DB_PASSWORD,
    connectionTimeoutMillis: 5000,
  };
  const admin = new Client({ ...dbOptions, database: 'postgres' });
  let users,
    catalog,
    broker,
    channel,
    redis,
    notifications,
    catalogProcess,
    notificationOutput,
    origin;

  t.after(async () => {
    await Promise.all(processes.map(stop));
    if (notifications) await notifications.close();
    if (redis?.status === 'ready') {
      for (const prefix of [cachePrefix, bullPrefix]) {
        const keys = await scanKeys(redis, prefix);
        if (keys.length) await redis.del(...keys);
      }
    }
    redis?.disconnect();
    if (channel) {
      for (const queue of createdQueues) await channel.deleteQueue(queue);
      await channel.deleteQueue(catalogDlq);
      await channel.deleteQueue(notificationQueue);
      await channel.deleteQueue(notificationRetryQueue);
      await channel.deleteQueue(notificationDlq);
      await channel.deleteExchange(catalogExchange);
      await channel.deleteExchange(catalogDlx);
      await channel.deleteExchange(catalogEventExchange);
      await channel.deleteExchange(notificationRetryExchange);
      await channel.deleteExchange(notificationDlx);
      await channel.close();
    }
    if (broker) await broker.close();
    if (users) await users.end();
    if (catalog) await catalog.end();
    for (const database of createdDatabases)
      await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);
    await admin.end();
  });

  // The development setup intentionally hosts both service databases in one server.
  assert.ok(
    userEnv.RABBITMQ_URL === catalogEnv.RABBITMQ_URL,
    'Services must use the same broker',
  );
  assert.ok(
    userEnv.JWT_SECRET === catalogEnv.JWT_SECRET,
    'Services must share the JWT secret',
  );
  await admin.connect();
  for (const database of [userDb, catalogDb]) {
    await admin.query(`CREATE DATABASE "${database}"`);
    createdDatabases.push(database);
  }
  users = new Client({ ...dbOptions, database: userDb });
  await users.connect();
  catalog = new Client({ ...dbOptions, database: catalogDb });
  await catalog.connect();
  broker = await amqp.connect(userEnv.RABBITMQ_URL);
  channel = await broker.createChannel();
  await channel.assertQueue(userQueue, { durable: true });
  createdQueues.push(userQueue, catalogQueue);
  redis = new Redis({
    host: catalogEnv.REDIS_HOST || 'localhost',
    port: Number(catalogEnv.REDIS_PORT || 6379),
    db: Number(catalogEnv.REDIS_DB || 0),
    lazyConnect: true,
    retryStrategy: null,
    enableOfflineQueue: false,
    connectTimeout: 3000,
  });
  redis.on('error', () => {});
  await redis.connect();
  notifications = new Bull('notifications', {
    redis: {
      host: catalogEnv.REDIS_HOST || 'localhost',
      port: Number(catalogEnv.REDIS_PORT || 6379),
      db: Number(catalogEnv.REDIS_DB || 0),
    },
    prefix: bullPrefix,
  });
  await notifications.isReady();

  async function start(app, env) {
    const child = spawn(process.execPath, [`dist/apps/${app}/main.js`], {
      cwd: process.cwd(),
      env: { ...process.env, ...env, NO_COLOR: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    processes.push(child);
    let address;
    let output = '';
    await new Promise((resolveReady, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`${app} startup timed out`)),
        20000,
      );
      child.stdout.on('data', (chunk) => {
        output += chunk.toString();
        const match = output.match(/Gateway listening at (http:\/\/[^\s]+)/);
        if (
          (app === 'gateway' && match) ||
          (app !== 'gateway' &&
            output.includes('Nest microservice successfully started'))
        ) {
          address = match?.[1];
          clearTimeout(timer);
          resolveReady();
        }
      });
      child.stderr.resume();
      child.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once('exit', (code) => {
        clearTimeout(timer);
        reject(new Error(`${app} exited before readiness (code ${code})`));
      });
    });
    return { child, address, getOutput: () => output };
  }
  await start('user-service', {
    ...userEnv,
    DB_DATABASE: userDb,
    DB_SYNCHRONIZE: 'true',
    RABBITMQ_QUEUE: userQueue,
  });
  ({ getOutput: notificationOutput } = await start('notification-service', {
    RABBITMQ_URL: userEnv.RABBITMQ_URL,
    RABBITMQ_QUEUE: notificationQueue,
    RABBITMQ_EVENT_EXCHANGE: catalogEventExchange,
    RABBITMQ_RETRY_EXCHANGE: notificationRetryExchange,
    RABBITMQ_RETRY_QUEUE: notificationRetryQueue,
    RABBITMQ_DLX: notificationDlx,
    RABBITMQ_DLQ: notificationDlq,
    RABBITMQ_DLQ_ROUTING_KEY: 'gateway.notification.dead',
  }));
  ({ child: catalogProcess } = await start('catalog-service', {
    ...catalogEnv,
    DB_HOST: userEnv.DB_HOST,
    DB_PORT: userEnv.DB_PORT,
    DB_USERNAME: userEnv.DB_USERNAME,
    DB_PASSWORD: userEnv.DB_PASSWORD,
    DB_DATABASE: catalogDb,
    DB_SYNCHRONIZE: 'true',
    RABBITMQ_QUEUE: catalogQueue,
    RABBITMQ_EXCHANGE: catalogExchange,
    RABBITMQ_DLX: catalogDlx,
    RABBITMQ_DLQ: catalogDlq,
    RABBITMQ_DLQ_ROUTING_KEY: 'gateway.catalog.dead',
    RABBITMQ_EVENT_EXCHANGE: catalogEventExchange,
    NOTIFICATION_QUEUE: notificationQueue,
    CACHE_PREFIX: cachePrefix,
    BULL_PREFIX: bullPrefix,
  }));
  const gatewayEnv = {
    PORT: '0',
    HOST: '127.0.0.1',
    RABBITMQ_URL: userEnv.RABBITMQ_URL,
    USER_QUEUE: userQueue,
    CATALOG_QUEUE: catalogQueue,
    CATALOG_EXCHANGE: catalogExchange,
  };
  ({ address: origin } = await start('gateway', gatewayEnv));

  async function request(
    method,
    path,
    body,
    token,
    headers = {},
    base = origin,
  ) {
    // All API scenarios now run through curl, including protected README routes.
    // JSON bodies go through stdin, and curl is invoked without shell evaluation.
    const args = [
      '--silent',
      '--show-error',
      '--http1.1',
      '--include',
      '--max-time',
      '8',
      '--request',
      method,
      '--write-out',
      '\n%{http_code}',
      `${base}${path}`,
    ];
    const requestHeaders = {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    };
    for (const [key, value] of Object.entries(requestHeaders))
      args.push('--header', `${key}: ${value}`);
    if (body !== undefined) args.push('--data-binary', '@-');
    const pending = runFile('curl', args);
    pending.child.stdin.end(
      body === undefined ? undefined : JSON.stringify(body),
    );
    const { stdout } = await pending.catch(() => {
      throw new Error(`curl failed for ${method} ${path}`);
    });
    const index = stdout.lastIndexOf('\n');
    const boundary = stdout.indexOf('\r\n\r\n');
    assert.ok(boundary >= 0, 'curl must include HTTP headers');
    const responseHeaders = new Headers();
    for (const line of stdout.slice(0, boundary).split('\r\n').slice(1)) {
      const colon = line.indexOf(':');
      if (colon > 0)
        responseHeaders.append(
          line.slice(0, colon),
          line.slice(colon + 1).trim(),
        );
    }
    const status = Number(stdout.slice(index + 1));
    return {
      status,
      headers: responseHeaders,
      body:
        status === 204
          ? undefined
          : JSON.parse(stdout.slice(boundary + 4, index)),
    };
  }
  const curl = request;
  function success(result, status) {
    assert.equal(result.status, status);
    assert.deepEqual(Object.keys(result.body).sort(), [
      'data',
      'success',
      'timestamp',
    ]);
    assert.equal(result.body.success, true);
    assert.ok(Number.isFinite(Date.parse(result.body.timestamp)));
    return result.body.data;
  }
  function failure(result, status) {
    assert.equal(result.status, status);
    assert.equal(result.body.success, false);
    assert.equal(result.body.statusCode, status);
    assert.deepEqual(Object.keys(result.body).sort(), [
      'message',
      'statusCode',
      'success',
    ]);
  }
  const ownerCredentials = exampleBody('### 1. Register a new user');
  const otherCredentials = {
    username: 'gateway_other',
    password: 'gateway_password_123',
  };
  const laptopData = exampleBody('### Create a new laptop (Protected Route)');
  const shopData = exampleBody(
    '### Create a Shop AND an initial Laptop (Atomic Transaction)',
  );
  let owner, ownerToken, otherToken, adminToken, laptop, shop;

  await t.test(
    'register forwards to user-service and wraps the reply once',
    async () => {
      owner = success(
        await request('POST', '/auth/register', ownerCredentials),
        201,
      );
      assert.equal(owner.username, ownerCredentials.username);
      assert.equal(owner.password, undefined);
      success(await request('POST', '/auth/register', otherCredentials), 201);
    },
  );
  await t.test(
    'curl login completes a round trip through RabbitMQ',
    async () => {
      ownerToken = success(
        await curl('POST', '/auth/login', ownerCredentials),
        201,
      ).access_token;
      assert.equal(typeof ownerToken, 'string');
      otherToken = success(
        await request('POST', '/auth/login', otherCredentials),
        201,
      ).access_token;
    },
  );
  await t.test(
    'registration conflicts and validation become HTTP errors',
    async () => {
      failure(await request('POST', '/auth/register', ownerCredentials), 409);
      failure(
        await request('POST', '/auth/register', {
          username: 'x',
          password: 'x',
        }),
        400,
      );
      failure(
        await request('POST', '/auth/register', {
          ...ownerCredentials,
          role: 'admin',
        }),
        400,
      );
    },
  );
  await t.test(
    'curl laptop list completes a catalog round trip with security headers',
    async () => {
      const data = success(await curl('GET', '/laptops'), 200);
      assert.deepEqual(data, {
        items: [],
        meta: { total: 0, page: 1, limit: 10, lastPage: 0 },
      });
      const response = await request('GET', '/laptops');
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(response.headers.get('x-powered-by'), null);
      assert.equal(response.headers.get('access-control-allow-origin'), '*');
    },
  );
  await t.test('CORS preflight permits the authorization header', async () => {
    const response = await request(
      'OPTIONS',
      '/laptops',
      undefined,
      undefined,
      {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'authorization,content-type',
      },
    );
    assert.equal(response.status, 204);
    assert.ok(
      response.headers
        .get('access-control-allow-headers')
        .includes('authorization'),
    );
  });
  await t.test(
    'gateway rejects missing or malformed bearer headers',
    async () => {
      failure(await request('POST', '/laptops', laptopData), 401);
      failure(
        await request('POST', '/laptops', laptopData, undefined, {
          authorization: 'Basic test',
        }),
        401,
      );
    },
  );
  await t.test(
    'create forwards the bearer JWT and keeps the HTTP body shape',
    async () => {
      laptop = success(
        await request('POST', '/laptops', laptopData, ownerToken),
        201,
      );
      assert.equal(laptop.userId, owner.id);
      assert.equal(laptop.price, laptopData.price);
      const notificationDeadline = Date.now() + 2000;
      while (
        Date.now() < notificationDeadline &&
        !notificationOutput().includes(
          'Simulated notification for laptop_created',
        )
      ) {
        await delay(25);
      }
      assert.match(
        notificationOutput(),
        /Simulated notification for laptop_created/,
      );
      assert.match(notificationOutput(), new RegExp(`"laptopId":${laptop.id}`));
      failure(
        await request(
          'POST',
          '/laptops',
          { ...laptopData, userId: 99 },
          ownerToken,
        ),
        400,
      );
    },
  );
  await t.test('findOne forwards path IDs and maps catalog 404s', async () => {
    assert.equal(
      success(await request('GET', `/laptops/${laptop.id}`), 200).id,
      laptop.id,
    );
    failure(await request('GET', '/laptops/999999'), 404);
    failure(await request('GET', '/laptops/not-a-number'), 400);
  });
  await t.test(
    'JWT verification and ownership remain enforced by catalog',
    async () => {
      failure(
        await request(
          'PATCH',
          `/laptops/${laptop.id}`,
          { price: 2000 },
          'invalid.jwt.token',
        ),
        401,
      );
      failure(
        await request(
          'PATCH',
          `/laptops/${laptop.id}`,
          { price: 2000 },
          otherToken,
        ),
        403,
      );
      assert.equal(
        success(
          await request(
            'PATCH',
            `/laptops/${laptop.id}`,
            { price: 115000 },
            ownerToken,
          ),
          200,
        ).price,
        115000,
      );
    },
  );
  await t.test(
    'query parameters reach catalog and the gateway adds no cache',
    async () => {
      const data = success(
        await request(
          'GET',
          `/laptops?brand=${encodeURIComponent(laptopData.brand)}&minPrice=0&sort=price&order=desc&page=1&limit=1`,
        ),
        200,
      );
      assert.equal(data.items[0].price, 115000);
      assert.equal(data.meta.limit, 1);
      failure(await request('GET', '/laptops?limit=-1'), 400);
      failure(await request('GET', '/laptops?minPrice=10&maxPrice=1'), 400);
    },
  );
  await t.test(
    'public shop routes preserve their URLs and nested request body',
    async () => {
      failure(await request('GET', '/shops'), 404);
      const result = success(await request('POST', '/shops', shopData), 201);
      assert.equal(
        result,
        'New Shop and initial Laptop have been created successfully!',
      );
      [shop] = success(await request('GET', '/shops'), 200);
      const linked = success(
        await request('POST', `/shops/${shop.id}/laptops/${laptop.id}`),
        201,
      );
      assert.ok(linked.laptops.some((item) => item.id === laptop.id));
      assert.equal(
        success(await request('GET', `/shops/laptop/${laptop.id}`), 200)[0].id,
        shop.id,
      );
      const jobs = await notifications.getJobs([
        'waiting',
        'active',
        'completed',
        'failed',
        'delayed',
      ]);
      const job = jobs.find(
        (job) => job.data.shopId === shop.id && job.data.laptopId === laptop.id,
      );
      assert.ok(job, 'Linking through HTTP must enqueue a Bull job');
      assert.equal(job.name, 'laptop-linked');
      assert.equal(job.opts.attempts, 3);
      assert.deepEqual(job.opts.backoff, { type: 'exponential', delay: 5000 });
      await job.finished();
      assert.equal(await job.getState(), 'completed');
    },
  );
  await t.test(
    'admin user list forwards tokens and maps authorization failures',
    async () => {
      failure(await request('GET', '/users'), 401);
      failure(await request('GET', '/users', undefined, ownerToken), 403);
      await users.query('UPDATE users SET role = $1 WHERE id = $2', [
        'admin',
        owner.id,
      ]);
      // More than six seconds may have elapsed by now; either way this is a valid login.
      adminToken = success(
        await request('POST', '/auth/login', ownerCredentials),
        201,
      ).access_token;
      const list = success(
        await request('GET', '/users', undefined, adminToken),
        200,
      );
      assert.equal(list.length, 2);
      assert.ok(list.every((user) => !Object.hasOwn(user, 'password')));
    },
  );
  await t.test(
    'delete forwards the ID and preserves ownership restrictions',
    async () => {
      failure(
        await request('DELETE', `/laptops/${laptop.id}`, undefined, otherToken),
        403,
      );
      success(
        await request('DELETE', `/laptops/${laptop.id}`, undefined, ownerToken),
        200,
      );
      failure(await request('GET', `/laptops/${laptop.id}`), 404);
    },
  );
  await t.test(
    "admin can delete other users' laptops but cannot update them",
    async () => {
      const otherLaptop = success(
        await request('POST', '/laptops', laptopData, otherToken),
        201,
      );
      failure(
        await request(
          'PATCH',
          `/laptops/${otherLaptop.id}`,
          { price: 115000 },
          adminToken,
        ),
        403,
      );
      success(
        await request(
          'DELETE',
          `/laptops/${otherLaptop.id}`,
          undefined,
          adminToken,
        ),
        200,
      );
    },
  );
  await t.test(
    'client-supplied IDs from the old README are rejected',
    async () => {
      failure(
        await request(
          'POST',
          '/laptops',
          { ...laptopData, id: 1025 },
          ownerToken,
        ),
        400,
      );
    },
  );
  await t.test(
    'expired and forged JWTs are rejected through the gateway',
    async () => {
      const expired = new JwtService({ secret: userEnv.JWT_SECRET }).sign(
        { sub: owner.id, role: 'admin' },
        { expiresIn: -1 },
      );
      const forged = new JwtService({ secret: 'not-the-shared-secret' }).sign(
        { sub: owner.id, role: 'admin' },
        { expiresIn: '1h' },
      );
      failure(await request('POST', '/laptops', laptopData, expired), 401);
      failure(await request('POST', '/laptops', laptopData, forged), 401);
    },
  );
  await t.test(
    'shop validation and a database failure leave neither partial record',
    async () => {
      const counts = async () =>
        (
          await catalog.query(
            'SELECT (SELECT count(*)::int FROM laptops) AS laptops, (SELECT count(*)::int FROM shop) AS shops',
          )
        ).rows[0];
      const before = await counts();
      failure(
        await request('POST', '/shops', {
          ...shopData,
          shop: { name: '', location: 'Bole' },
        }),
        400,
      );
      assert.deepEqual(await counts(), before);
      await catalog.query(
        "ALTER TABLE shop ADD CONSTRAINT gateway_test_rollback CHECK (name <> 'force_rollback')",
      );
      try {
        failure(
          await request('POST', '/shops', {
            ...shopData,
            shop: { name: 'force_rollback', location: 'Bole' },
          }),
          500,
        );
        assert.deepEqual(await counts(), before);
      } finally {
        await catalog.query(
          'ALTER TABLE shop DROP CONSTRAINT gateway_test_rollback',
        );
      }
    },
  );
  await t.test(
    'README advanced query stays cached for 60 seconds, then refreshes',
    async () => {
      const path =
        '/laptops?brand=Apple&minPrice=50000&maxPrice=200000&sort=price&order=DESC&page=1&limit=5';
      const first = success(await request('GET', path), 200);
      assert.equal(first.items.length, 1);
      assert.equal(first.items[0].brand, 'Apple');
      assert.equal(first.items[0].price, 150000);
      const keys = await scanKeys(redis, cachePrefix);
      const key = keys.find((key) => key.includes('"brand":"Apple"'));
      assert.ok(key);
      const ttl = await redis.pttl(key);
      assert.ok(ttl > 55000 && ttl <= 60000);
      const extra = success(
        await request(
          'POST',
          '/laptops',
          { ...shopData.laptop, price: 190000 },
          ownerToken,
        ),
        201,
      );
      const cached = success(await request('GET', path), 200);
      assert.deepEqual(
        cached,
        first,
        'Writes must not invalidate the cached list',
      );
      assert.equal(
        success(await request('GET', `/laptops/${extra.id}`), 200).price,
        190000,
      );
      t.diagnostic(
        'Waiting for the real 60-second cache expiry; no TTL override is used.',
      );
      await delay(30000);
      await delay(31000);
      const refreshed = success(await request('GET', path), 200);
      assert.deepEqual(
        refreshed.items.map((item) => item.price),
        [190000, 150000],
      );
      assert.deepEqual(refreshed.meta, {
        total: 2,
        page: 1,
        limit: 5,
        lastPage: 1,
      });
      success(
        await request('DELETE', `/laptops/${extra.id}`, undefined, ownerToken),
        200,
      );
    },
  );
  await t.test(
    'wrong passwords and unknown usernames preserve their HTTP status codes',
    async () => {
      failure(
        await request('POST', '/auth/login', {
          ...ownerCredentials,
          password: 'wrong_password_123',
        }),
        401,
      );
      failure(
        await request('POST', '/auth/login', {
          ...ownerCredentials,
          username: 'unknown_account',
        }),
        404,
      );
    },
  );
  await t.test(
    'unknown HTTP routes have the existing error wrapper',
    async () => {
      failure(await request('GET', '/unknown-route'), 404);
    },
  );
  await t.test(
    'default rate limit survives forwarded-IP spoofing',
    async () => {
      let limited = false;
      for (let i = 0; i < 11; i++) {
        const response = await request(
          'GET',
          '/shops/laptop/999999',
          undefined,
          undefined,
          { 'x-forwarded-for': `192.0.2.${i + 1}` },
        );
        if (response.status === 429) {
          failure(response, 429);
          limited = true;
          break;
        }
        failure(response, 404);
      }
      assert.ok(limited);
    },
  );
  await t.test('login has its stricter three-attempt limit', async () => {
    let limited = false;
    for (let i = 0; i < 4; i++) {
      const response = await request('POST', '/auth/login', {
        ...ownerCredentials,
        password: 'wrong_password_123',
      });
      if (response.status === 429) {
        failure(response, 429);
        limited = true;
        break;
      }
      failure(response, 401);
    }
    assert.ok(limited);
  });
  await t.test(
    'an offline catalog returns 504 within five seconds, while users still work',
    async () => {
      await stop(catalogProcess);
      const started = performance.now();
      failure(await request('GET', '/laptops'), 504);
      const elapsed = performance.now() - started;
      assert.ok(elapsed >= 4800 && elapsed < 6500);
      success(await request('GET', '/users', undefined, adminToken), 200);
      await delay(100);
      assert.equal((await channel.checkQueue(catalogQueue)).messageCount, 0);
    },
  );
  await t.test(
    'a timed-out write is sent once with a broker expiry',
    async () => {
      let received = 0;
      let expiry;
      const { consumerTag } = await channel.consume(
        catalogQueue,
        (message) => {
          if (!message) return;
          received++;
          expiry = message.properties.expiration;
          // Deliberately do not reply, emulating a slow service.
        },
        { noAck: true },
      );
      try {
        failure(await request('POST', '/laptops', laptopData, ownerToken), 504);
        assert.equal(received, 1);
        assert.equal(expiry, '5000');
      } finally {
        await channel.cancel(consumerTag);
      }
    },
  );
  await t.test(
    'internal service errors are sanitized before reaching HTTP clients',
    async () => {
      const { consumerTag } = await channel.consume(
        catalogQueue,
        (message) => {
          if (!message) return;
          channel.sendToQueue(
            message.properties.replyTo,
            Buffer.from(
              JSON.stringify({
                err: {
                  success: false,
                  statusCode: 500,
                  message: 'private database details',
                },
                isDisposed: true,
              }),
            ),
            { correlationId: message.properties.correlationId },
          );
        },
        { noAck: true },
      );
      try {
        const response = await request('GET', '/laptops');
        failure(response, 500);
        assert.equal(response.body.message, 'Internal server error');
      } finally {
        await channel.cancel(consumerTag);
      }
    },
  );
  await t.test(
    'broker connection failures return 503 without hanging HTTP',
    async () => {
      const reservation = createServer();
      await new Promise((resolve) =>
        reservation.listen(0, '127.0.0.1', resolve),
      );
      const port = reservation.address().port;
      await new Promise((resolve) => reservation.close(resolve));
      const unavailable = await start('gateway', {
        ...gatewayEnv,
        RABBITMQ_URL: `amqp://127.0.0.1:${port}`,
      });
      try {
        failure(
          await request(
            'GET',
            '/laptops',
            undefined,
            undefined,
            {},
            unavailable.address,
          ),
          503,
        );
      } finally {
        await stop(unavailable.child);
      }
    },
  );
});
