import { Logger } from '@nestjs/common';
import {
  CredentialsExpiredException,
  TokenRefreshFailedException,
} from './google-oauth.exceptions';

describe('Google OAuth credential exception log redaction', () => {
  const canary = 'OAUTH_REFRESH_PRIVATE_TOKEN';
  afterEach(() => jest.restoreAllMocks());

  it('keeps refresh status/type diagnostics while dropping provider payloads and messages', () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const exception = new TokenRefreshFailedException(
      `provider failure token=${canary}`,
      new Error(`refresh_token=${canary}`)
    );
    expect(exception.getStatus()).toBe(500);
    expect(error).toHaveBeenCalledWith('[TOKEN_REFRESH_FAILED] OAuth credential operation failed', {
      statusCode: 500,
      detailType: 'Error',
    });
    expect(JSON.stringify(error.mock.calls)).not.toContain(canary);
  });

  it('keeps expired credential status without logging refresh response details', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const exception = new CredentialsExpiredException('storage', 'storage', {
      response: { access_token: canary },
    });
    expect(exception.getStatus()).toBe(401);
    expect(warn).toHaveBeenCalledWith('[CREDENTIALS_EXPIRED] OAuth credential operation failed', {
      statusCode: 401,
      detailType: 'provider_payload',
    });
    expect(JSON.stringify(warn.mock.calls)).not.toContain(canary);
    expect(JSON.stringify(exception.getResponse())).not.toContain(canary);
  });
});
