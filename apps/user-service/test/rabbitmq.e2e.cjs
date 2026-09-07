const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { parse } = require('dotenv');
const { Client } = require('pg');
const amqp = require('amqplib');
const bcrypt = require('bcrypt');
const { JwtService } = require('@nestjs/jwt');
const { ClientProxyFactory, Transport } = require('@nestjs/microservices');
const { firstValueFrom, timeout } = require('rxjs');

// Exercise the compiled standalone process with real PostgreSQL and RabbitMQ.
// Only the uniquely named test database/queue are created and removed.
test('user-service RabbitMQ integration', { timeout: 60000 }, async (t) => {
  const env = {
    ...parse(readFileSync(resolve('apps/user-service/.env'))),
    ...process.env,
  };
  const suffix = randomUUID().replaceAll('-', '');
  const database = `user_service_test_${suffix}`;
  const queue = `user_service_test_${suffix}`;
  const dbOptions = {
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 5434),
    user: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    connectionTimeoutMillis: 5000,
  };
  const admin = new Client({ ...dbOptions, database: 'postgres' });
  let databaseCreated = false;
  let db;
  let child;
  let client;
  let broker;
  let channel;

  t.after(async () => {
    if (client) client.close();
    if (child && child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit');
      child.kill('SIGTERM');
      const killTimer = setTimeout(() => child.kill('SIGKILL'), 5000);
      await exited;
      clearTimeout(killTimer);
    }
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
  // Establish the test queue before startup so cleanup also handles boot failures.
  await channel.assertQueue(queue, { durable: true });

  child = spawn(process.execPath, ['dist/apps/user-service/main.js'], {
    cwd: process.cwd(),
    env: {
      ...env,
      DB_DATABASE: database,
      DB_SYNCHRONIZE: 'true',
      RABBITMQ_QUEUE: queue,
      NO_COLOR: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolveReady, reject) => {
    const timer = setTimeout(
      () => reject(new Error('User-service startup timed out')),
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
    // Do not print configuration values or credentials if boot fails.
    child.stderr.resume();
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`User-service exited before readiness (code ${code})`));
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
  const send = (pattern, data) =>
    firstValueFrom(client.send(pattern, data).pipe(timeout(5000)));
  const expectError = (request, statusCode) =>
    assert.rejects(request, (error) => {
      assert.equal(error.statusCode, statusCode);
      assert.equal(error.success, false);
      assert.ok(
        typeof error.message === 'string' || Array.isArray(error.message),
      );
      assert.equal(error.stack, undefined);
      return true;
    });
  const credentials = { username: 'test_owner', password: 'test_password_123' };
  const jwt = new JwtService({
    secret: env.JWT_SECRET,
    verifyOptions: { algorithms: ['HS256'] },
  });
  let user;
  let token;

  await t.test('standalone service has an active consumer', async () => {
    assert.equal((await channel.checkQueue(queue)).consumerCount, 1);
  });
  await t.test(
    'registration stores a hash and returns no password',
    async () => {
      user = await send('user.register', credentials);
      assert.equal(user.username, credentials.username);
      assert.equal(user.role, 'user');
      assert.equal(user.password, undefined);
      assert.ok(Number.isInteger(user.id));
      const { rows } = await db.query(
        'SELECT password FROM users WHERE id = $1',
        [user.id],
      );
      assert.notEqual(rows[0].password, credentials.password);
      assert.ok(await bcrypt.compare(credentials.password, rows[0].password));
    },
  );
  await t.test('duplicate registration returns 409', () =>
    expectError(send('user.register', credentials), 409),
  );
  await t.test('invalid input returns 400', () =>
    expectError(send('user.register', { username: 'x', password: 'x' }), 400),
  );
  await t.test('missing fields return 400', () =>
    expectError(send('user.register', {}), 400),
  );
  await t.test('registration cannot inject an admin role', () =>
    expectError(
      send('user.register', {
        ...credentials,
        username: 'bad_admin',
        role: 'admin',
      }),
      400,
    ),
  );
  await t.test(
    'login returns a verified token with a one-hour lifetime',
    async () => {
      ({ access_token: token } = await send('user.login', credentials));
      const claims = await jwt.verifyAsync(token);
      assert.equal(claims.sub, user.id);
      assert.equal(claims.role, 'user');
      assert.equal(claims.exp - claims.iat, 3600);
    },
  );
  await t.test('wrong password returns 401', () =>
    expectError(
      send('user.login', { ...credentials, password: 'wrong_password' }),
      401,
    ),
  );
  await t.test('unknown username keeps the existing 404 behavior', () =>
    expectError(
      send('user.login', { ...credentials, username: 'missing_user' }),
      404,
    ),
  );
  await t.test('missing token returns 401', () =>
    expectError(send('user.findAll', {}), 401),
  );
  await t.test('regular user cannot list users', () =>
    expectError(send('user.findAll', { token }), 403),
  );
  await t.test('untrusted role fields do not bypass authorization', () =>
    expectError(
      send('user.findAll', { token, role: 'admin', user: { role: 'admin' } }),
      403,
    ),
  );
  await t.test('forged token is rejected', async () => {
    const forged = new JwtService({ secret: 'different-secret' }).sign(
      { sub: user.id, role: 'admin' },
      { expiresIn: '1h' },
    );
    await expectError(send('user.findAll', { token: forged }), 401);
  });
  await t.test('expired token is rejected', async () => {
    const expired = jwt.sign(
      { sub: user.id, role: 'admin' },
      { expiresIn: -1 },
    );
    await expectError(send('user.findAll', { token: expired }), 401);
  });
  await t.test('signed token without expiry is rejected', async () => {
    const noExpiry = jwt.sign({ sub: user.id, role: 'admin' });
    await expectError(send('user.findAll', { token: noExpiry }), 401);
  });
  await t.test(
    'admin login can list users without exposing password hashes',
    async () => {
      await db.query('UPDATE users SET role = $1 WHERE id = $2', [
        'admin',
        user.id,
      ]);
      const login = await send('user.login', credentials);
      const users = await send('user.findAll', { token: login.access_token });
      assert.equal(users.length, 1);
      assert.equal(users[0].id, user.id);
      assert.equal(users[0].role, 'admin');
      assert.ok(users.every((entry) => !Object.hasOwn(entry, 'password')));
    },
  );
  await t.test(
    'duplicate requests do not create duplicate accounts',
    async () => {
      const data = { username: 'concurrent_user', password: 'password_123' };
      const results = await Promise.allSettled([
        send('user.register', data),
        send('user.register', data),
      ]);
      assert.equal(
        results.filter((result) => result.status === 'fulfilled').length,
        1,
      );
      assert.equal(
        results.find((result) => result.status === 'rejected').reason
          .statusCode,
        409,
      );
      const { rows } = await db.query(
        'SELECT count(*)::int AS count FROM users WHERE username = $1',
        [data.username],
      );
      assert.equal(rows[0].count, 1);
    },
  );
});
