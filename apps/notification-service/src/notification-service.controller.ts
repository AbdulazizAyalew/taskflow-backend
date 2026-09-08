import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import type { Channel, ConsumeMessage } from 'amqplib';

interface LaptopCreatedEvent {
  laptopId: number;
  userId: number | null;
  brand: string;
}

@Controller()
export class NotificationServiceController {
  private readonly logger = new Logger(NotificationServiceController.name);

  @EventPattern('laptop_created')
  handleLaptopCreated(
    @Payload() event: LaptopCreatedEvent,
    @Ctx() context: RmqContext,
  ): void {
    this.logger.log(
      `Simulated notification for laptop_created: ${JSON.stringify(event)}`,
    );
    const channel = context.getChannelRef() as Channel;
    const message = context.getMessage() as ConsumeMessage;
    channel.ack(message);
  }
}
