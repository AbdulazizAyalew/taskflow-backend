import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import type { Channel, ConsumeMessage } from 'amqplib';
import { RetryService } from './rabbitmq/retry.service';

import type { LaptopCreatedEvent } from '@app/shared';

@Controller()
export class NotificationServiceController {
  private readonly logger = new Logger(NotificationServiceController.name);

  constructor(private readonly retries: RetryService) {}

  @EventPattern('laptop_created')
  handleLaptopCreated(
    @Payload() event: LaptopCreatedEvent,
    @Ctx() context: RmqContext,
  ): Promise<void> {
    return this.processLaptopCreated(event, context);
  }

  private async processLaptopCreated(
    event: LaptopCreatedEvent,
    context: RmqContext,
  ): Promise<void> {
    const attempt = this.retries.getAttempt(context);
    const channel = context.getChannelRef() as Channel;
    const message = context.getMessage() as ConsumeMessage;
    try {
      if (event.simulateFailure) {
        throw new Error('Forced notification failure');
      }
      this.logger.log(
        `Simulated notification for laptop_created: ${JSON.stringify(event)}`,
      );
      channel.ack(message);
    } catch {
      await this.retries.retryOrDeadLetter(context, attempt);
    }
  }
}
