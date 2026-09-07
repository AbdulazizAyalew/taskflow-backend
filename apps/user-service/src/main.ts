import { NestFactory } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { UserServiceModule } from './user-service.module';

async function bootstrap() {
  await ConfigModule.envVariablesLoaded;
  const url = process.env.RABBITMQ_URL;
  if (!url) throw new Error('RABBITMQ_URL is required');

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    UserServiceModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: [url],
        queue: process.env.RABBITMQ_QUEUE || 'user_queue',
        // No automatic redelivery of writes in this milestone.
        noAck: true,
        queueOptions: { durable: true },
      },
    },
  );
  app.enableShutdownHooks();
  await app.listen();
}

bootstrap().catch(() => {
  console.error(
    'User-service failed to start. Check its configuration and infrastructure.',
  );
  process.exitCode = 1;
});
