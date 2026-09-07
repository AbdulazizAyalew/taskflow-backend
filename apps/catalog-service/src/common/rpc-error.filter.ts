import {
  ArgumentsHost,
  Catch,
  HttpException,
  RpcExceptionFilter,
} from '@nestjs/common';
import { RmqContext, RpcException } from '@nestjs/microservices';
import type { Channel, ConsumeMessage } from 'amqplib';
import { throwError } from 'rxjs';

@Catch()
export class RpcErrorFilter implements RpcExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToRpc().getContext<RmqContext>();
    const channel = context.getChannelRef() as Channel;
    const rmqMessage = context.getMessage() as ConsumeMessage;

    if (exception instanceof RpcException) {
      channel.ack(rmqMessage);
      return throwError(() => exception.getError());
    }
    let statusCode = 500;
    let message: string | string[] = 'Internal server error';
    if (exception instanceof HttpException) {
      channel.ack(rmqMessage);
      statusCode = exception.getStatus();
      const response = exception.getResponse();
      message =
        typeof response === 'string'
          ? response
          : (response as { message?: string | string[] }).message ||
            exception.message;
    } else if ((exception as { code?: string } | null)?.code === '23505') {
      channel.ack(rmqMessage);
      statusCode = 409;
      message = 'This record already exists. Please use a unique value.';
    } else {
      // Reject an unexpected failure instead of acknowledging it. Issue 2 will
      // attach a dead-letter exchange so rejected deliveries are retained.
      channel.nack(rmqMessage, false, false);
    }
    return throwError(() => ({ success: false, statusCode, message }));
  }
}
