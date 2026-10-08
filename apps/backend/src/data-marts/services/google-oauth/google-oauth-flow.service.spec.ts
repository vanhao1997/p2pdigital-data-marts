jest.mock('google-auth-library', () => ({ OAuth2Client: jest.fn() }));
jest.mock('../data-storage-credential.service', () => ({
  DataStorageCredentialService: jest.fn(),
}));
jest.mock('../data-destination-credential.service', () => ({
  DataDestinationCredentialService: jest.fn(),
}));
jest.mock('./google-oauth-config.service', () => ({ GoogleOAuthConfigService: jest.fn() }));

import { Logger } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { GoogleOAuthFlowService } from './google-oauth-flow.service';

describe('GoogleOAuthFlowService refresh secret redaction', () => {
  const secret = 'GOOGLE_REFRESH_PRIVATE_TOKEN';

  const setup = () => {
    const refreshAccessToken = jest
      .fn()
      .mockResolvedValue({ credentials: { access_token: 'new-token', expiry_date: 1 } });
    (OAuth2Client as jest.Mock).mockImplementation(() => ({
      setCredentials: jest.fn(),
      refreshAccessToken,
    }));
    const credentials = {
      getById: jest
        .fn()
        .mockResolvedValue({
          id: 'credential',
          credentials: { refresh_token: secret, access_token: 'old-token' },
        }),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const config = {
      getStorageClientId: jest.fn().mockReturnValue('client'),
      getStorageClientSecret: jest.fn().mockReturnValue(secret),
      getDestinationClientId: jest.fn().mockReturnValue('client'),
      getDestinationClientSecret: jest.fn().mockReturnValue(secret),
      getRedirectUri: jest.fn().mockReturnValue('https://example.com/callback'),
    };
    const service = new GoogleOAuthFlowService(
      credentials as never,
      credentials as never,
      config as never,
      {} as never,
      {} as never
    );
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    return { service, credentials, refreshAccessToken, error, warn };
  };
  afterEach(() => jest.restoreAllMocks());

  it('redacts failed refresh provider details at the flow and exception logger boundaries', async () => {
    const { service, refreshAccessToken, error } = setup();
    refreshAccessToken.mockRejectedValue(new Error(`refresh_token=${secret}`));
    await expect(
      service.refreshTokensByCredentialId('credential', 'storage')
    ).rejects.toMatchObject({ code: 'TOKEN_REFRESH_FAILED' });
    expect(error).toHaveBeenCalledWith(
      'Failed to refresh tokens for storage credential credential'
    );
    expect(JSON.stringify(error.mock.calls)).not.toContain(secret);
  });

  it('redacts persistence failures after refreshing access tokens', async () => {
    const { service, credentials, error } = setup();
    credentials.update.mockRejectedValue(new Error(`parameters access_token=${secret}`));
    await expect(
      service.refreshTokensByCredentialId('credential', 'storage')
    ).rejects.toMatchObject({ code: 'TOKEN_REFRESH_FAILED' });
    expect(error).toHaveBeenCalledWith(
      'Failed to save refreshed tokens for storage credential credential'
    );
    expect(JSON.stringify(error.mock.calls)).not.toContain(secret);
  });

  it('retains invalid_grant reauthorization semantics without echoing tokens', async () => {
    const { service, refreshAccessToken, warn } = setup();
    refreshAccessToken.mockRejectedValue(new Error(`invalid_grant refresh_token=${secret}`));
    await expect(
      service.refreshTokensByCredentialId('credential', 'storage')
    ).rejects.toMatchObject({ code: 'CREDENTIALS_EXPIRED' });
    expect(JSON.stringify(warn.mock.calls)).not.toContain(secret);
  });
});
