import { Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { BullModule } from '@nestjs/bull';
import { envValidationSchema } from './config/env.validation';
import { RpcErrorFilter } from './common/rpc-error.filter';
import { RabbitmqAckInterceptor } from './common/rabbitmq-ack.interceptor';
import { JwtStrategy } from './auth/jwt.strategy';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { Laptop } from './laptops/laptop.entity';
import { LaptopsController } from './laptops/laptops.controller';
import { LaptopsService } from './laptops/laptops.service';
import { LaptopCache } from './laptops/laptop-cache.service';
import { Shop } from './shops/shop.entity';
import { ShopsController } from './shops/shops.controller';
import { ShopsService } from './shops/shops.service';
import { NotificationsProcessor } from './notifications/notifications.processor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: 'apps/catalog-service/.env',
      validationSchema: envValidationSchema,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.getOrThrow<string>('DB_HOST'),
        port: config.getOrThrow<number>('DB_PORT'),
        username: config.getOrThrow<string>('DB_USERNAME'),
        password: config.getOrThrow<string>('DB_PASSWORD'),
        database: config.getOrThrow<string>('DB_DATABASE'),
        autoLoadEntities: true,
        synchronize: config.getOrThrow<boolean>('DB_SYNCHRONIZE'),
        retryAttempts: 3,
      }),
    }),
    TypeOrmModule.forFeature([Laptop, Shop]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.getOrThrow<string>('REDIS_HOST'),
          port: config.getOrThrow<number>('REDIS_PORT'),
          db: config.getOrThrow<number>('REDIS_DB'),
        },
        prefix: config.getOrThrow<string>('BULL_PREFIX'),
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        },
      }),
    }),
    BullModule.registerQueue({ name: 'notifications' }),
  ],
  controllers: [LaptopsController, ShopsController],
  providers: [
    JwtStrategy,
    JwtAuthGuard,
    LaptopsService,
    LaptopCache,
    ShopsService,
    NotificationsProcessor,
    { provide: APP_FILTER, useClass: RpcErrorFilter },
    { provide: APP_INTERCEPTOR, useClass: RabbitmqAckInterceptor },
    {
      provide: APP_PIPE,
      useFactory: () =>
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
        }),
    },
  ],
})
export class CatalogServiceModule {}
