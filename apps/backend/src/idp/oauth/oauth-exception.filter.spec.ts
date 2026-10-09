import { ArgumentsHost, BadRequestException, Logger } from '@nestjs/common';
import { AuthenticationError, AuthorizationError } from '@owox/idp-protocol';
import { OAuthExceptionFilter } from './oauth-exception.filter';

describe('OAuthExceptionFilter', () => {
  it.each([
    [new AuthenticationError('secret-code'), 400, 'invalid_grant'],
    [new AuthorizationError('secret-token'), 403, 'access_denied'],
    [new BadRequestException('secret-query'), 400, 'invalid_request'],
    [new Error('secret-database-parameters'), 500, 'server_error'],
  ])('returns safe OAuth diagnostics for %s', (exception, status, error) => {
    const json = jest.fn();
    const setHeader = jest.fn();
    const statusFn = jest.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({ getResponse: () => ({ status: statusFn, setHeader }) }),
    } as unknown as ArgumentsHost;
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    new OAuthExceptionFilter().catch(exception, host);
    expect(statusFn).toHaveBeenCalledWith(status);
    expect(json).toHaveBeenCalledWith({ error });
    expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(JSON.stringify(json.mock.calls)).not.toContain('secret');
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });
});
