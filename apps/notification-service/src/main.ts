import { NestFactory } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { NotificationServiceModule } from './notification-service.module';
import { setupRetryTopology } from './rabbitmq/retry-topology';

async function bootstrap() {
  await ConfigModule.envVariablesLoaded;
  const url = process.env.RABBITMQ_URL;
  if (!url) throw new Error('RABBITMQ_URL is required');
  const eventExchange =
    process.env.RABBITMQ_EVENT_EXCHANGE || 'catalog_events_exchange';

  await setupRetryTopology(url, {
    eventExchange,
    retryExchange:
      process.env.RABBITMQ_RETRY_EXCHANGE || 'notification_retry_exchange',
    retryQueue: process.env.RABBITMQ_RETRY_QUEUE || 'notification_retry_queue',
    deadLetterExchange:
      process.env.RABBITMQ_DLX || 'notification_dead_letter_exchange',
    deadLetterQueue:
      process.env.RABBITMQ_DLQ || 'notification_dead_letter_queue',
    deadLetterRoutingKey:
      process.env.RABBITMQ_DLQ_ROUTING_KEY || 'notification.dead',
  });

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    NotificationServiceModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: [url],
        queue: process.env.RABBITMQ_QUEUE || 'notification_queue',
        exchange: eventExchange,
        exchangeType: 'topic',
        wildcards: true,
        noAck: false,
        prefetchCount: 10,
        queueOptions: { durable: true },
      },
    },
  );
  app.enableShutdownHooks();
  await app.listen();
}

bootstrap().catch(() => {
  console.error(
    'Notification-service failed to start. Check its RabbitMQ configuration.',
  );
  process.exitCode = 1;
});
