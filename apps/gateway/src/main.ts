import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { GatewayModule } from './gateway.module';

async function bootstrap() {
  const app = await NestFactory.create(GatewayModule);
  app.use(helmet());
  app.enableCors();
  app.enableShutdownHooks();
  const config = app.get(ConfigService);
  await app.listen(
    config.getOrThrow<number>('PORT'),
    config.getOrThrow<string>('HOST'),
  );
  console.log(`Gateway listening at ${await app.getUrl()}`);
}
bootstrap().catch(() => {
  console.error(
    'Gateway failed to start. Check its configuration and HTTP port.',
  );
  process.exitCode = 1;
});
