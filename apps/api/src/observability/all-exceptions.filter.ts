import {
  Catch,
  HttpException,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * `HttpException` bodies are passed through untouched — the 422 failure list and
 * the 409 conflict list are part of the contract. Anything else is a bug: it is
 * logged with the route that raised it and its stack, and the client is told
 * only that something broke.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Unhandled');

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();

    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    const request = context.getRequest<Request>();

    this.logger.error(`${request.method} ${request.originalUrl}`, (exception as Error)?.stack);

    response.status(500).json({
      statusCode: 500,
      message: 'Something went wrong handling this request.',
    });
  }
}
