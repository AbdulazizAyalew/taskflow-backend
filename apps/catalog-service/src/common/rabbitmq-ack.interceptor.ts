import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { RmqContext } from '@nestjs/microservices';
import type { Channel, ConsumeMessage } from 'amqplib';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class RabbitmqAckInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const rmqContext = context.switchToRpc().getContext<RmqContext>();

    return next.handle().pipe(
      tap(() => {
        const channel = rmqContext.getChannelRef() as Channel;
        const message = rmqContext.getMessage() as ConsumeMessage;
        channel.ack(message);
      }),
    );
  }
}
