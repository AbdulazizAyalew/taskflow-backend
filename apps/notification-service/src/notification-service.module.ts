import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { envValidationSchema } from './config/env.validation';
import { NotificationServiceController } from './notification-service.controller';
import { RetryService } from './rabbitmq/retry.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: 'apps/notification-service/.env',
      validationSchema: envValidationSchema,
    }),
  ],
  controllers: [NotificationServiceController],
  providers: [RetryService],
})
export class NotificationServiceModule {}
