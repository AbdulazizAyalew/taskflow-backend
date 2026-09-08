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
      await channel.deleteExchange(exchange);
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
      NO_COLOR: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  child.stdout.on('data', (chunk) => {
    output += chunk.toString();
  });
  child.stderr.resume();
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
});
