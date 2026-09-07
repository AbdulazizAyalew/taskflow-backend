import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
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
    }
    host.switchToHttp().getResponse<Response>().status(statusCode).json({
      success: false,
      message,
      statusCode,
    });
  }
}
