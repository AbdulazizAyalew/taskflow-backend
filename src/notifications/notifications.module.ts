import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { NotificationsProcessor } from './notifications.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'notifications', 
    }),
  ],
  exports: [BullModule],
  providers:[NotificationsProcessor],
})
export class NotificationsModule {}