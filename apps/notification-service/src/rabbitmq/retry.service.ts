import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RmqContext } from '@nestjs/microservices';
import type { ConsumeMessage, Options } from 'amqplib';

interface RabbitmqChannel {
  ack(message: ConsumeMessage): void;
  nack(message: ConsumeMessage, allUpTo?: boolean, requeue?: boolean): void;
  publish(
    exchange: string,
    routingKey: string,
    content: Buffer,
    options?: Options.Publish,
  ): Promise<unknown> | boolean;
}

@Injectable()
export class RetryService {
  private readonly logger = new Logger(RetryService.name);
  private readonly retryExchange: string;
  private readonly deadLetterExchange: string;
  private readonly deadLetterRoutingKey: string;
  private readonly maxAttempts: number;
  private readonly baseDelayMs: number;

  constructor(config: ConfigService) {
    this.retryExchange = config.getOrThrow<string>('RABBITMQ_RETRY_EXCHANGE');
    this.deadLetterExchange = config.getOrThrow<string>('RABBITMQ_DLX');
    this.deadLetterRoutingKey = config.getOrThrow<string>(
      'RABBITMQ_DLQ_ROUTING_KEY',
    );
    this.maxAttempts = config.getOrThrow<number>('RABBITMQ_MAX_ATTEMPTS');
    this.baseDelayMs = config.getOrThrow<number>(
      'RABBITMQ_RETRY_BASE_DELAY_MS',
    );
  }

  getAttempt(context: RmqContext): number {
    const message = context.getMessage() as ConsumeMessage;
    const previous = Number(
      message.properties.headers?.['x-retry-attempt'] || 0,
    );
    return previous + 1;
  }

  async retryOrDeadLetter(context: RmqContext, attempt: number): Promise<void> {
    const channel = context.getChannelRef() as RabbitmqChannel;
    const message = context.getMessage() as ConsumeMessage;

    try {
      if (attempt < this.maxAttempts) {
        const delay = this.baseDelayMs * 2 ** (attempt - 1);
        await channel.publish(
          this.retryExchange,
          message.fields.routingKey,
          message.content,
          {
            persistent: true,
            expiration: String(delay),
            headers: {
              ...message.properties.headers,
              'x-retry-attempt': attempt,
            },
          },
        );
        channel.ack(message);
        this.logger.warn(
          `laptop_created attempt ${attempt} failed; retrying in ${delay}ms`,
        );
        return;
      }

      await channel.publish(
        this.deadLetterExchange,
        this.deadLetterRoutingKey,
        message.content,
        {
          persistent: true,
          headers: {
            ...message.properties.headers,
            'x-retry-attempt': attempt,
          },
        },
      );
      channel.ack(message);
      this.logger.error(
        `laptop_created failed after ${attempt} attempts; moved to DLQ`,
      );
    } catch (error: unknown) {
      this.logger.error('Could not route failed laptop_created event', error);
      channel.nack(message, false, true);
    }
  }
}
