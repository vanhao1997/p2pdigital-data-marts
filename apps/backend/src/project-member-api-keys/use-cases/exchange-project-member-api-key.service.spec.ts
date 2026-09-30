import { AuthenticationError, type IdpProvider } from '@owox/idp-protocol';
import { IdpProviderService } from '../../idp/services/idp-provider.service';
import { ProjectMemberApiKeyService } from '../services/project-member-api-key.service';
import { ApiKeyExchangeRateLimiterService } from '../services/api-key-exchange-rate-limiter.service';
import {
  ApiKeyExchangeRateLimitError,
  ExchangeProjectMemberApiKeyService,
} from './exchange-project-member-api-key.service';

describe('ExchangeProjectMemberApiKeyService', () => {
  const apiKeyId = 'pmk_AbCdEfGhIjKlMnOpQrStUv';
  const apiKeySecret = 'vjqmM5GfJ6QklV8mFqM5Ior2hK6vK4mY8pE9T7aZr6Q';

  const createVerifiedKey = (overrides: Record<string, unknown> = {}) => ({
    apiKeyId,
    projectId: 'project-1',
    userId: 'user-1',
    role: null,
    readOnly: false,
    ...overrides,
  });

  const createService = () => {
    const projectMemberApiKeyService = {
      verifyCredential: jest.fn(),
      markAuthenticated: jest.fn(),
    } as unknown as jest.Mocked<ProjectMemberApiKeyService>;

    const idpProvider = {
      issueAccessTokenForProjectMemberApiKey: jest.fn(),
    } as unknown as jest.Mocked<IdpProvider>;

    const idpProviderService = {
      getProviderFromApp: jest.fn(() => idpProvider),
    } as unknown as jest.Mocked<IdpProviderService>;

    const rateLimiter = {
      createRateLimitKey: jest.fn(() => ({
        ipHash: 'hashed-ip',
        apiKeyIdHash: 'hashed-api-key-id',
        bucketStart: new Date('2026-01-01T00:00:00.000Z'),
      })),
      check: jest.fn().mockResolvedValue({ allowed: true }),
      recordFailure: jest.fn().mockResolvedValue(undefined),
      resetKeyBucket: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ApiKeyExchangeRateLimiterService>;

    const service = new ExchangeProjectMemberApiKeyService(
      projectMemberApiKeyService,
      idpProviderService,
      rateLimiter
    );

    return { service, projectMemberApiKeyService, idpProvider, rateLimiter };
  };

  it('exchanges a valid API key for an ODM access token and updates lastAuthenticatedAt', async () => {
    const { service, projectMemberApiKeyService, idpProvider, rateLimiter } = createService();
    projectMemberApiKeyService.verifyCredential.mockResolvedValue(createVerifiedKey());
    idpProvider.issueAccessTokenForProjectMemberApiKey.mockResolvedValue({
      accessToken: 'regular-odm-access-token',
      refreshToken: 'refresh-token-hidden-from-client',
      accessTokenExpiresIn: 900,
      refreshTokenExpiresIn: 3600,
    });

    const result = await service.run({ apiKeyId, apiKeySecret, ipAddress: '192.0.2.1' });

    expect(projectMemberApiKeyService.verifyCredential).toHaveBeenCalledWith(
      apiKeyId,
      apiKeySecret
    );
    expect(idpProvider.issueAccessTokenForProjectMemberApiKey).toHaveBeenCalledWith(
      apiKeyId,
      'user-1',
      'project-1',
      null,
      false
    );
    expect(projectMemberApiKeyService.markAuthenticated).toHaveBeenCalledWith(
      apiKeyId,
      expect.any(Date)
    );
    expect(rateLimiter.resetKeyBucket).toHaveBeenCalled();
    expect(result).toEqual({
      accessToken: 'regular-odm-access-token',
      accessTokenExpiresIn: 900,
    });
  });

  it('binds the stored API-key role and read-only restriction to the issued IDP token', async () => {
    const { service, projectMemberApiKeyService, idpProvider } = createService();
    projectMemberApiKeyService.verifyCredential.mockResolvedValue(
      createVerifiedKey({ role: 'viewer' })
    );
    idpProvider.issueAccessTokenForProjectMemberApiKey.mockResolvedValue({
      accessToken: 'regular-odm-access-token',
    });

    await service.run({ apiKeyId, apiKeySecret, ipAddress: '192.0.2.1' });

    expect(idpProvider.issueAccessTokenForProjectMemberApiKey).toHaveBeenCalledWith(
      apiKeyId,
      'user-1',
      'project-1',
      'viewer',
      false
    );
  });

  it('does not update lastAuthenticatedAt when the secret is invalid', async () => {
    const { service, projectMemberApiKeyService, rateLimiter } = createService();
    projectMemberApiKeyService.verifyCredential.mockResolvedValue(null);

    await expect(
      service.run({ apiKeyId, apiKeySecret, ipAddress: '192.0.2.1' })
    ).rejects.toBeInstanceOf(AuthenticationError);

    expect(rateLimiter.recordFailure).toHaveBeenCalled();

    expect(projectMemberApiKeyService.markAuthenticated).not.toHaveBeenCalled();
  });

  it('does not exchange revoked keys', async () => {
    const { service, projectMemberApiKeyService, idpProvider } = createService();
    projectMemberApiKeyService.verifyCredential.mockResolvedValue(null);

    await expect(
      service.run({ apiKeyId, apiKeySecret, ipAddress: '192.0.2.1' })
    ).rejects.toBeInstanceOf(AuthenticationError);

    expect(idpProvider.issueAccessTokenForProjectMemberApiKey).not.toHaveBeenCalled();
    expect(projectMemberApiKeyService.markAuthenticated).not.toHaveBeenCalled();
  });

  it('rejects rate-limited requests before credential verification', async () => {
    const { service, projectMemberApiKeyService, rateLimiter } = createService();
    rateLimiter.check.mockResolvedValue({ allowed: false, retryAfterSeconds: 17 });

    await expect(service.run({ apiKeyId, apiKeySecret, ipAddress: '192.0.2.1' })).rejects.toEqual(
      expect.objectContaining({
        constructor: ApiKeyExchangeRateLimitError,
        retryAfterSeconds: 17,
      })
    );
    expect(projectMemberApiKeyService.verifyCredential).not.toHaveBeenCalled();
  });
});
