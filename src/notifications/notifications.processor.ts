import { Processor, Process, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';

@Processor('notifications')
export class NotificationsProcessor {
  
  private readonly logger = new Logger(NotificationsProcessor.name);

  @Process('laptop-linked')
  async handleLaptopLinked(job: Job) {
    this.logger.debug(`[Job ${job.id}] Processing '${job.name}'...`);
    this.logger.debug(`Payload: ${JSON.stringify(job.data)}`);

    await new Promise((resolve) => setTimeout(resolve, 2000));


    this.logger.debug(`[Job ${job.id}] Notification sent successfully.`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job) {
    this.logger.log(`✅ Job ${job.id} completed.`);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(`❌ Job ${job.id} failed: ${error.message}`);
  }
}