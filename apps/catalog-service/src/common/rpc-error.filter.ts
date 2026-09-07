import { Catch, HttpException, RpcExceptionFilter } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { throwError } from 'rxjs';

@Catch()
export class RpcErrorFilter implements RpcExceptionFilter {
  catch(exception: unknown) {
    if (exception instanceof RpcException) {
      return throwError(() => exception.getError());
    }
    let statusCode = 500;
    let message: string | string[] = 'Internal server error';
    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const response = exception.getResponse();
      message =
        typeof response === 'string'
          ? response
          : (response as { message?: string | string[] }).message ||
            exception.message;
    } else if ((exception as { code?: string } | null)?.code === '23505') {
      statusCode = 409;
      message = 'This record already exists. Please use a unique value.';
    }
    return throwError(() => ({ success: false, statusCode, message }));
  }
}
