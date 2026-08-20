import { 
  ExceptionFilter, 
  Catch, 
  ArgumentsHost, 
  HttpException, 
  HttpStatus 
} from '@nestjs/common';
import { Response } from 'express';


@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';

    // 1. Handle standard NestJS Exceptions (including class-validator errors)
    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      message = (exceptionResponse as any).message || exception.message;
    } 

    // 2. Handle TypeORM/PostgreSQL specific errors
    else if (exception.code === '23505') {
      statusCode = HttpStatus.CONFLICT;
      message = 'This record already exists. Please use a unique value.';
    } 

    // 3. Unhandled Server Errors
    else {
      console.error('Unhandled Exception:', exception);
    }

    response.status(statusCode).json({
      success: false,
      message,
      statusCode,
    });
  }
}