const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { parse } = require('dotenv');
const { Client } = require('pg');
const amqp = require('amqplib');
const Redis = require('ioredis');
const Bull = require('bull');
const { JwtService } = require('@nestjs/jwt');
const { ClientProxyFactory, Transport } = require('@nestjs/microservices');
const { firstValueFrom, timeout } = require('rxjs');

async function keysWithPrefix(redis, prefix) {
  let cursor = '0';
  const keys = [];
  do {
    const result = await redis.scan(
      cursor,
      'MATCH',
      `${prefix}:*`,
      'COUNT',
      100,
    );
    cursor = result[0];
    keys.push(...result[1]);
  } while (cursor !== '0');
  return keys;
}

test('catalog-service RabbitMQ integration', { timeout: 60000 }, async (t) => {
  const env = {
    ...parse(readFileSync(resolve('apps/catalog-service/.env'))),
    ...process.env,
  };
  const suffix = randomUUID().replaceAll('-', '');
  const database = `catalog_service_test_${suffix}`;
  const queue = `catalog_service_test_${suffix}`;
  const cachePrefix = `catalog_test_cache_${suffix}`;
  const bullPrefix = `catalog_test_bull_${suffix}`;
  const dbOptions = {
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 5434),
    user: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    connectionTimeoutMillis: 5000,
  };
  const redisOptions = {
    host: env.REDIS_HOST || 'localhost',
    port: Number(env.REDIS_PORT || 6379),
    db: Number(env.REDIS_DB || 0),
  };
  const admin = new Client({ ...dbOptions, database: 'postgres' });
  let databaseCreated = false;
  let db, child, client, broker, channel, redis, notifications;

  t.after(async () => {
    if (client) client.close();
    if (child && child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit');
      child.kill('SIGTERM');
      const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
      await exited;
      clearTimeout(timer);
    }
    if (notifications) await notifications.close();
    if (redis?.status === 'ready') {
      // Delete only this test's namespaced cache and Bull keys, never FLUSHDB.
      for (const prefix of [cachePrefix, bullPrefix]) {
        const keys = await keysWithPrefix(redis, prefix);
        if (keys.length) await redis.del(...keys);
      }
    }
    redis?.disconnect();
    if (channel) {
      await channel.deleteQueue(queue);
      await channel.close();
    }
    if (broker) await broker.close();
    if (db) await db.end();
    if (databaseCreated)
      await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);
    await admin.end();
  });

  await admin.connect();
  await admin.query(`CREATE DATABASE "${database}"`);
  databaseCreated = true;
  db = new Client({ ...dbOptions, database });
  await db.connect();
  broker = await amqp.connect(env.RABBITMQ_URL);
  channel = await broker.createChannel();
  await channel.assertQueue(queue, { durable: true });
  redis = new Redis({
    ...redisOptions,
    lazyConnect: true,
    retryStrategy: null,
    enableOfflineQueue: false,
    connectTimeout: 3000,
  });
  redis.on('error', () => {});
  await redis.connect();
  notifications = new Bull('notifications', {
    redis: redisOptions,
    prefix: bullPrefix,
  });
  await notifications.isReady();

  child = spawn(process.execPath, ['dist/apps/catalog-service/main.js'], {
    cwd: process.cwd(),
    env: {
      ...env,
      DB_DATABASE: database,
      DB_SYNCHRONIZE: 'true',
      RABBITMQ_QUEUE: queue,
      CACHE_PREFIX: cachePrefix,
      BULL_PREFIX: bullPrefix,
      NO_COLOR: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolveReady, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Catalog-service startup timed out')),
      20000,
    );
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
      if (output.includes('Nest microservice successfully started')) {
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
      reject(
        new Error(`Catalog-service exited before readiness (code ${code})`),
      );
    });
  });
  client = ClientProxyFactory.create({
    transport: Transport.RMQ,
    options: {
      urls: [env.RABBITMQ_URL],
      queue,
      queueOptions: { durable: true },
    },
  });
  await client.connect();
  const send = (pattern, payload = {}) =>
    firstValueFrom(
      client.send(`catalog.${pattern}`, payload).pipe(timeout(5000)),
    );
  const expectError = (request, statusCode) =>
    assert.rejects(request, (error) => {
      assert.equal(error.statusCode, statusCode);
      assert.equal(error.success, false);
      assert.equal(error.stack, undefined);
      return true;
    });
  // Same signed claim contract as user-service; no user DB/process is needed.
  const jwt = new JwtService({ secret: env.JWT_SECRET });
  const owner = jwt.sign(
    { sub: 42, username: 'owner', role: 'user' },
    { expiresIn: '1h' },
  );
  const bystander = jwt.sign(
    { sub: 77, username: 'other', role: 'user' },
    { expiresIn: '1h' },
  );
  const adminToken = jwt.sign(
    { sub: 99, username: 'admin', role: 'admin' },
    { expiresIn: '1h' },
  );
  const laptopData = {
    description: 'A brand new laptop',
    brand: 'Dell',
    ram: 16,
    price: 1000,
  };
  let laptop, second, shop;

  await t.test(
    'standalone service has one active consumer and no users table',
    async () => {
      assert.equal((await channel.checkQueue(queue)).consumerCount, 1);
      const { rows } = await db.query(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public'",
      );
      assert.ok(rows.some((row) => row.tablename === 'laptops'));
      assert.ok(rows.some((row) => row.tablename === 'shop'));
      assert.ok(!rows.some((row) => row.tablename === 'users'));
    },
  );
  await t.test(
    'public laptop list has the existing pagination shape',
    async () => {
      assert.deepEqual(await send('laptops.findAll'), {
        items: [],
        meta: { total: 0, page: 1, limit: 10, lastPage: 0 },
      });
    },
  );
  await t.test('empty shop list retains its 404', () =>
    expectError(send('shops.findAll'), 404),
  );
  await t.test('create without authentication is rejected', () =>
    expectError(send('laptops.create', { laptop: laptopData }), 401),
  );
  await t.test('forged token is rejected', async () => {
    const token = new JwtService({ secret: 'wrong-secret' }).sign(
      { sub: 42, role: 'user' },
      { expiresIn: '1h' },
    );
    await expectError(
      send('laptops.create', { token, laptop: laptopData }),
      401,
    );
  });
  await t.test('expired token is rejected', () =>
    expectError(
      send('laptops.create', {
        token: jwt.sign({ sub: 42, role: 'user' }, { expiresIn: -1 }),
        laptop: laptopData,
      }),
      401,
    ),
  );
  await t.test('invalid subject and role claims are rejected', async () => {
    for (const claims of [
      { sub: '42', role: 'user' },
      { sub: 42, role: 'superadmin' },
    ]) {
      await expectError(
        send('laptops.create', {
          token: jwt.sign(claims, { expiresIn: '1h' }),
          laptop: laptopData,
        }),
        401,
      );
    }
  });
  await t.test('token without expiry is rejected', () =>
    expectError(
      send('laptops.create', {
        token: jwt.sign({ sub: 42, role: 'user' }),
        laptop: laptopData,
      }),
      401,
    ),
  );
  await t.test(
    'creation stores the owner from the verified token',
    async () => {
      laptop = await send('laptops.create', {
        token: owner,
        laptop: laptopData,
      });
      assert.ok(Number.isInteger(laptop.id));
      assert.equal(laptop.userId, 42);
      assert.equal(laptop.price, 1000);
    },
  );
  await t.test('nested data cannot set ownership', () =>
    expectError(
      send('laptops.create', {
        token: owner,
        laptop: { ...laptopData, userId: 77 },
      }),
      400,
    ),
  );
  await t.test('missing nested data is rejected', () =>
    expectError(send('laptops.create', { token: owner }), 400),
  );
  await t.test('invalid nested laptop data is rejected', () =>
    expectError(
      send('laptops.create', {
        token: owner,
        laptop: { ...laptopData, description: 'short', price: -1 },
      }),
      400,
    ),
  );
  await t.test('public findOne reads a laptop and validates IDs', async () => {
    assert.equal(
      (await send('laptops.findOne', { id: String(laptop.id) })).id,
      laptop.id,
    );
    await expectError(send('laptops.findOne', { id: 'invalid' }), 400);
    await expectError(send('laptops.findOne', { id: 999999 }), 404);
  });
  await t.test(
    'only owners can update, including no admin bypass',
    async () => {
      for (const token of [bystander, adminToken]) {
        await expectError(
          send('laptops.update', {
            token,
            id: laptop.id,
            laptop: { price: 2000 },
          }),
          403,
        );
      }
      assert.equal(
        (await send('laptops.findOne', { id: laptop.id })).price,
        1000,
      );
    },
  );
  await t.test('spoofed caller fields cannot override token identity', () =>
    expectError(
      send('laptops.update', {
        token: bystander,
        id: laptop.id,
        laptop: { price: 2000 },
        user: { userId: 42, role: 'admin' },
      }),
      400,
    ),
  );
  await t.test('laptop list is cached in Redis for 60 seconds', async () => {
    const result = await send('laptops.findAll', { brand: 'Dell' });
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].price, 1000);
    const keys = await keysWithPrefix(redis, cachePrefix);
    const key = keys.find((key) => key.includes('"brand":"Dell"'));
    assert.ok(key);
    const ttl = await redis.pttl(key);
    assert.ok(ttl > 55000 && ttl <= 60000);
    assert.equal(JSON.parse(await redis.get(key)).items[0].price, 1000);
  });
  await t.test(
    'owner update works and does not clear cached lists',
    async () => {
      const updated = await send('laptops.update', {
        token: owner,
        id: laptop.id,
        laptop: { price: 1500 },
      });
      assert.equal(updated.price, 1500);
      assert.equal(
        (await send('laptops.findAll', { brand: 'Dell' })).items[0].price,
        1000,
      );
      assert.equal(
        (await send('laptops.findOne', { id: laptop.id })).price,
        1500,
      );
    },
  );
  await t.test('creation also leaves existing list cache intact', async () => {
    second = await send('laptops.create', {
      token: bystander,
      laptop: { ...laptopData, price: 2500 },
    });
    assert.equal(
      (await send('laptops.findAll', { brand: 'Dell' })).items.length,
      1,
    );
  });
  await t.test(
    'filter, sort, page, and limit use distinct cache keys',
    async () => {
      const result = await send('laptops.findAll', {
        brand: 'Dell',
        minPrice: '0',
        maxPrice: '3000',
        sort: 'price',
        order: 'desc',
        page: '1',
        limit: '1',
      });
      assert.deepEqual(result.meta, {
        total: 2,
        page: 1,
        limit: 1,
        lastPage: 2,
      });
      assert.equal(result.items[0].id, second.id);
      const page2 = await send('laptops.findAll', {
        brand: 'Dell',
        minPrice: 0,
        maxPrice: 3000,
        sort: 'price',
        order: 'DESC',
        page: 2,
        limit: 1,
      });
      assert.equal(page2.items[0].id, laptop.id);
      assert.equal(
        (await send('laptops.findAll', { minPrice: 2000 })).items[0].id,
        second.id,
      );
      assert.equal(
        (await send('laptops.findAll', { maxPrice: 2000 })).items[0].id,
        laptop.id,
      );
      assert.equal(
        (await send('laptops.findAll', { brand: 'Apple' })).items.length,
        0,
      );
    },
  );
  await t.test(
    'invalid pagination, sort, and price range return 400',
    async () => {
      for (const query of [
        { page: 0 },
        { limit: -1 },
        { sort: 'password' },
        { minPrice: 10, maxPrice: 1 },
      ]) {
        await expectError(send('laptops.findAll', query), 400);
      }
    },
  );
  await t.test('expired cache refreshes from PostgreSQL', async () => {
    const keys = await keysWithPrefix(redis, cachePrefix);
    const key = keys.find((key) =>
      key.includes('"brand":"Dell","minPrice":null'),
    );
    assert.ok(key);
    // Verify the configured TTL above; shorten only this test key to avoid a minute-long test.
    await redis.pexpire(key, 1);
    await delay(20);
    const fresh = await send('laptops.findAll', { brand: 'Dell' });
    assert.equal(fresh.items.length, 2);
    assert.equal(fresh.items.find((item) => item.id === laptop.id).price, 1500);
  });
  await t.test('null updates and owner reassignment are rejected', async () => {
    for (const patch of [{ price: null }, { userId: 77 }]) {
      await expectError(
        send('laptops.update', { token: owner, id: laptop.id, laptop: patch }),
        400,
      );
    }
  });
  await t.test(
    'public shop creation saves its initial laptop atomically',
    async () => {
      const result = await send('shops.create', {
        shop: { name: 'Test Shop', location: 'Bole' },
        laptop: { ...laptopData, brand: 'ShopStock' },
      });
      assert.equal(
        result,
        'New Shop and initial Laptop have been created successfully!',
      );
      [shop] = await send('shops.findAll');
      assert.equal(shop.userId, null);
      assert.equal(shop.laptops.length, 1);
      assert.equal(shop.laptops[0].userId, null);
    },
  );
  await t.test('invalid shop input writes neither record', async () => {
    const before = await db.query('SELECT count(*)::int AS count FROM laptops');
    await expectError(
      send('shops.create', {
        shop: { name: '', location: 'Bole' },
        laptop: laptopData,
      }),
      400,
    );
    const after = await db.query('SELECT count(*)::int AS count FROM laptops');
    assert.equal(after.rows[0].count, before.rows[0].count);
  });
  await t.test(
    'a database failure on shop save rolls back the initial laptop',
    async () => {
      const counts = async () =>
        (
          await db.query(
            'SELECT (SELECT count(*)::int FROM laptops) AS laptops, (SELECT count(*)::int FROM shop) AS shops',
          )
        ).rows[0];
      const before = await counts();
      await db.query(
        "ALTER TABLE shop ADD CONSTRAINT catalog_test_reject_name CHECK (name <> 'force_rollback')",
      );
      try {
        await expectError(
          send('shops.create', {
            shop: { name: 'force_rollback', location: 'Bole' },
            laptop: laptopData,
          }),
          500,
        );
        assert.deepEqual(await counts(), before);
      } finally {
        await db.query(
          'ALTER TABLE shop DROP CONSTRAINT catalog_test_reject_name',
        );
      }
    },
  );
  await t.test(
    'linking preserves the relationship and Bull processes the notification',
    async () => {
      const linked = await send('shops.addLaptop', {
        shopId: shop.id,
        laptopId: laptop.id,
      });
      assert.ok(linked.laptops.some((item) => item.id === laptop.id));
      const jobs = await notifications.getJobs([
        'waiting',
        'active',
        'completed',
        'delayed',
        'failed',
      ]);
      const job = jobs.find((job) => job.data.laptopId === laptop.id);
      assert.ok(job);
      assert.equal(job.name, 'laptop-linked');
      assert.equal(job.data.shopId, shop.id);
      assert.equal(job.opts.attempts, 3);
      assert.deepEqual(job.opts.backoff, { type: 'exponential', delay: 5000 });
      assert.notEqual(await job.getState(), 'completed');
      await job.finished();
      assert.equal(await job.getState(), 'completed');
    },
  );
  await t.test(
    'shop inventory reads are uncached and filter by laptop',
    async () => {
      const shops = await send('shops.findAll');
      assert.equal(shops[0].laptops.length, 2);
      assert.equal(
        (await send('shops.findByLaptop', { laptopId: laptop.id }))[0].id,
        shop.id,
      );
      await expectError(send('shops.findByLaptop', { laptopId: 999999 }), 404);
      const cacheKeys = await keysWithPrefix(redis, cachePrefix);
      assert.ok(cacheKeys.every((key) => key.includes(':laptops:v1:')));
    },
  );
  await t.test(
    'repeated linking does not duplicate inventory or notifications',
    async () => {
      const before = await notifications.getJobCounts();
      const linked = await send('shops.addLaptop', {
        shopId: shop.id,
        laptopId: laptop.id,
      });
      assert.equal(
        linked.laptops.filter((item) => item.id === laptop.id).length,
        1,
      );
      assert.deepEqual(await notifications.getJobCounts(), before);
    },
  );
  await t.test(
    'linking rejects missing shop, laptop, or invalid IDs',
    async () => {
      await expectError(
        send('shops.addLaptop', { shopId: 999999, laptopId: laptop.id }),
        404,
      );
      await expectError(
        send('shops.addLaptop', { shopId: shop.id, laptopId: 999999 }),
        404,
      );
      await expectError(
        send('shops.addLaptop', { shopId: 'bad', laptopId: laptop.id }),
        400,
      );
    },
  );
  await t.test('bystanders cannot delete while admins can', async () => {
    await expectError(
      send('laptops.delete', { token: bystander, id: laptop.id }),
      403,
    );
    await send('laptops.delete', { token: adminToken, id: laptop.id });
    await expectError(send('laptops.findOne', { id: laptop.id }), 404);
    const shops = await send('shops.findAll');
    assert.ok(!shops[0].laptops.some((item) => item.id === laptop.id));
    assert.ok(
      (await send('laptops.findAll', { brand: 'Dell' })).items.some(
        (item) => item.id === laptop.id,
      ),
    );
  });
  await t.test('owners can delete their laptops', async () => {
    await send('laptops.delete', { token: bystander, id: second.id });
    await expectError(send('laptops.findOne', { id: second.id }), 404);
  });
});
