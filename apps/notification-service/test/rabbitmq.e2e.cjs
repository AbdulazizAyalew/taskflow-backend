const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { readFileSync } = require('node:fs');
const { setTimeout: delay } = require('node:timers/promises');
const { parse } = require('dotenv');
const amqp = require('amqplib');

test('notification-service consumes laptop_created events', async (t) => {
  const env = {
    ...parse(readFileSync('apps/catalog-service/.env')),
    ...process.env,
  };
  const suffix = randomUUID().replaceAll('-', '');
  const queue = `notification_service_test_${suffix}`;
  const exchange = `notification_service_test_events_${suffix}`;
  const retryExchange = `notification_service_test_retry_exchange_${suffix}`;
  const retryQueue = `notification_service_test_retry_queue_${suffix}`;
  const deadLetterExchange = `notification_service_test_dlx_${suffix}`;
  const deadLetterQueue = `notification_service_test_dlq_${suffix}`;
  let broker, channel, child;

  t.after(async () => {
    if (child && child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit');
      child.kill('SIGTERM');
      const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
      await exited;
      clearTimeout(timer);
    }
    if (channel) {
      await channel.deleteQueue(queue);
      await channel.deleteQueue(retryQueue);
      await channel.deleteQueue(deadLetterQueue);
      await channel.deleteExchange(exchange);
      await channel.deleteExchange(retryExchange);
      await channel.deleteExchange(deadLetterExchange);
      await channel.close();
    }
    if (broker) await broker.close();
  });

  broker = await amqp.connect(env.RABBITMQ_URL);
  channel = await broker.createChannel();
  child = spawn(process.execPath, ['dist/apps/notification-service/main.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      RABBITMQ_URL: env.RABBITMQ_URL,
      RABBITMQ_QUEUE: queue,
      RABBITMQ_EVENT_EXCHANGE: exchange,
      RABBITMQ_RETRY_EXCHANGE: retryExchange,
      RABBITMQ_RETRY_QUEUE: retryQueue,
      RABBITMQ_DLX: deadLetterExchange,
      RABBITMQ_DLQ: deadLetterQueue,
      RABBITMQ_DLQ_ROUTING_KEY: 'notification.test.dead',
      RABBITMQ_MAX_ATTEMPTS: '3',
      RABBITMQ_RETRY_BASE_DELAY_MS: '50',
      NO_COLOR: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  child.stdout.on('data', (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    output += chunk.toString();
  });
  const startupDeadline = Date.now() + 10000;
  while (
    Date.now() < startupDeadline &&
    !output.includes('Nest microservice successfully started')
  ) {
    if (child.exitCode !== null) throw new Error('notification-service exited');
    await delay(25);
  }
  assert.match(output, /Nest microservice successfully started/);

  channel.publish(
    exchange,
    'laptop_created',
    Buffer.from(
      JSON.stringify({
        pattern: 'laptop_created',
        data: { laptopId: 7, userId: 3, brand: 'ThinkPad' },
      }),
    ),
    { persistent: true },
  );

  const logDeadline = Date.now() + 5000;
  while (
    Date.now() < logDeadline &&
    !output.includes('Simulated notification for laptop_created')
  ) {
    await delay(25);
  }
  assert.match(output, /Simulated notification for laptop_created/);
  assert.match(output, /"laptopId":7/);
  assert.equal((await channel.checkQueue(queue)).messageCount, 0);

  channel.publish(
    exchange,
    'laptop_created',
    Buffer.from(
      JSON.stringify({
        pattern: 'laptop_created',
        data: {
          laptopId: 8,
          userId: 3,
          brand: 'Broken',
          simulateFailure: true,
        },
      }),
    ),
    { persistent: true },
  );

  const retryDeadline = Date.now() + 5000;
  while (Date.now() < retryDeadline) {
    const reachedDlq =
      (await channel.checkQueue(deadLetterQueue)).messageCount === 1;
    const logged = output.includes('failed after 3 attempts; moved to DLQ');
    if (reachedDlq && logged) break;
    await delay(25);
  }
  assert.match(output, /attempt 1 failed; retrying in 50ms/);
  assert.match(output, /attempt 2 failed; retrying in 100ms/);
  assert.match(output, /failed after 3 attempts; moved to DLQ/);
  const deadLetter = await channel.get(deadLetterQueue, { noAck: true });
  assert.ok(deadLetter);
  assert.equal(deadLetter.properties.headers['x-retry-attempt'], 3);
  assert.equal(JSON.parse(deadLetter.content.toString()).data.laptopId, 8);
});
