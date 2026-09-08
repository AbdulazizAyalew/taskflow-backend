import { NestFactory } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { NotificationServiceModule } from './notification-service.module';

async function bootstrap() {
  await ConfigModule.envVariablesLoaded;
  const url = process.env.RABBITMQ_URL;
  if (!url) throw new Error('RABBITMQ_URL is required');

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    NotificationServiceModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: [url],
        queue: process.env.RABBITMQ_QUEUE || 'notification_queue',
        exchange:
          process.env.RABBITMQ_EVENT_EXCHANGE || 'catalog_events_exchange',
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
