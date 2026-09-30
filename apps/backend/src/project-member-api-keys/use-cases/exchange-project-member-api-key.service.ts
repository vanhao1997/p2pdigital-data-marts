import { Injectable } from '@nestjs/common';
import { AuthenticationError } from '@owox/idp-protocol';
import { IdpProviderService } from '../../idp/services/idp-provider.service';
import type { ExchangeProjectMemberApiKeyCommand } from '../dto/domain/exchange-project-member-api-key.command';
import type { ExchangeProjectMemberApiKeyResult } from '../dto/domain/exchange-project-member-api-key-result.dto';
import { ApiKeyExchangeRateLimiterService } from '../services/api-key-exchange-rate-limiter.service';
import { ProjectMemberApiKeyService } from '../services/project-member-api-key.service';
import { ApiKeyKdfCapacityError } from '../services/project-member-api-key-crypto.service';
import type { ProjectMemberApiKeyIssuingParameters } from '../dto/domain/project-member-api-key-issuing-parameters.dto';

export class ApiKeyExchangeRateLimitError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super('API-key exchange rate limit exceeded');
    this.name = 'ApiKeyExchangeRateLimitError';
  }
}

@Injectable()
export class ExchangeProjectMemberApiKeyService {
  constructor(
    private readonly projectMemberApiKeyService: ProjectMemberApiKeyService,
    private readonly idpProviderService: IdpProviderService,
    private readonly rateLimiter: ApiKeyExchangeRateLimiterService
  ) {}

  async run(
    command: ExchangeProjectMemberApiKeyCommand
  ): Promise<ExchangeProjectMemberApiKeyResult> {
    const rateLimitKey = this.rateLimiter.createRateLimitKey(command.ipAddress, command.apiKeyId);
    const decision = await this.rateLimiter.check(rateLimitKey);
    if (!decision.allowed) {
      throw new ApiKeyExchangeRateLimitError(decision.retryAfterSeconds ?? 1);
    }

    let apiKey: ProjectMemberApiKeyIssuingParameters | null;
    try {
      apiKey = await this.projectMemberApiKeyService.verifyCredential(
        command.apiKeyId,
        command.apiKeySecret
      );
    } catch (error) {
      if (error instanceof ApiKeyKdfCapacityError) {
        throw new ApiKeyExchangeRateLimitError(1);
      }
      throw error;
    }
    if (!apiKey) {
      await this.rateLimiter.recordFailure(rateLimitKey);
      throw this.invalidCredentials();
    }

    const tokenResult = await this.idpProviderService
      .getProviderFromApp()
      .issueAccessTokenForProjectMemberApiKey(
        apiKey.apiKeyId,
        apiKey.userId,
        apiKey.projectId,
        apiKey.role,
        apiKey.readOnly
      );

    await this.rateLimiter.resetKeyBucket(rateLimitKey);

    await this.projectMemberApiKeyService.markAuthenticated(apiKey.apiKeyId, new Date());

    return {
      accessToken: tokenResult.accessToken,
      ...(typeof tokenResult.accessTokenExpiresIn === 'number'
        ? { accessTokenExpiresIn: tokenResult.accessTokenExpiresIn }
        : {}),
    };
  }

  private invalidCredentials(): AuthenticationError {
    return new AuthenticationError('Unauthorized');
  }
}
