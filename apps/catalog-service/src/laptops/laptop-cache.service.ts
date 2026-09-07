import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { ListLaptopsDto } from './dto/laptop-messages.dto';

@Injectable()
export class LaptopCache implements OnModuleInit, OnModuleDestroy {
  private readonly redis: Redis;
  private readonly prefix: string;
  private readonly logger = new Logger(LaptopCache.name);

  constructor(config: ConfigService) {
    this.prefix = `${config.getOrThrow<string>('CACHE_PREFIX')}:${config.getOrThrow<string>('DB_DATABASE')}:laptops:v1`;
    this.redis = new Redis({
      host: config.getOrThrow<string>('REDIS_HOST'),
      port: config.getOrThrow<number>('REDIS_PORT'),
      db: config.getOrThrow<number>('REDIS_DB'),
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
    });
    this.redis.on('error', () =>
      this.logger.warn('Laptop cache unavailable; reads will use PostgreSQL.'),
    );
  }

  async onModuleInit() {
    try {
      await this.redis.connect();
    } catch {
      /* Cache is an optimization. */
    }
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }

  async remember<T>(query: ListLaptopsDto, load: () => Promise<T>): Promise<T> {
    const key = `${this.prefix}:${JSON.stringify({
      page: query.page,
      limit: query.limit,
      sort: query.sort,
      order: query.order,
      brand: query.brand ?? null,
      minPrice: query.minPrice ?? null,
      maxPrice: query.maxPrice ?? null,
    })}`;
    try {
      const cached = await this.redis.get(key);
      if (cached !== null) return JSON.parse(cached) as T;
    } catch {
      /* Read fresh data when Redis is unavailable or its entry is invalid. */
    }
    const result = await load();
    try {
      await this.redis.set(key, JSON.stringify(result), 'EX', 60);
    } catch {
      /* Do not turn a successful database read into a failed request. */
    }
    return result;
  }
}
