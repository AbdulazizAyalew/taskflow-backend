import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'notifications', 
    }),
  ],
  exports: [BullModule],
})
export class NotificationsModule {}