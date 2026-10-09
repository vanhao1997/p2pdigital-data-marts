import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { AuthenticationError, AuthorizationError } from '@owox/idp-protocol';
import type { Response } from 'express';

/** OAuth diagnostics must never echo callback queries, codes or token payloads. */
@Catch()
export class OAuthExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status =
      exception instanceof AuthenticationError
        ? 400
        : exception instanceof AuthorizationError
          ? 403
          : exception instanceof HttpException
            ? exception.getStatus()
            : 500;
    const error =
      exception instanceof AuthenticationError
        ? 'invalid_grant'
        : status === 403
          ? 'access_denied'
          : status < 500
            ? 'invalid_request'
            : 'server_error';
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Pragma', 'no-cache');
    response.status(status).json({ error });
  }
}
