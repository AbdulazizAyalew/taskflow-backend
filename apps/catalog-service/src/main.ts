import { NestFactory } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { CatalogServiceModule } from './catalog-service.module';

async function bootstrap() {
  await ConfigModule.envVariablesLoaded;
  const url = process.env.RABBITMQ_URL;
  if (!url) throw new Error('RABBITMQ_URL is required');
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    CatalogServiceModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: [url],
        queue: process.env.RABBITMQ_QUEUE || 'catalog_queue',
        exchange: process.env.RABBITMQ_EXCHANGE || 'catalog_exchange',
        exchangeType: 'direct',
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
    'Catalog-service failed to start. Check its configuration and infrastructure.',
  );
  process.exitCode = 1;
});
