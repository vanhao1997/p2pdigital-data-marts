import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { McpScope } from '@owox/idp-protocol';
import { z } from 'zod';
import { OAuthClientRegistry } from './oauth-client.registry';
import { OAuthConfigService } from './oauth-config.service';
import { OAuthRegistrationRateLimiterService } from './oauth-registration-rate-limiter.service';
import { OAuthRedirectUriPolicy } from './oauth-redirect-uri.policy';

export interface OAuthDynamicClientRegistrationRequest {
  redirect_uris?: string[];
  client_name?: string;
  grant_types?: string[];
  response_types?: string[];
  token_endpoint_auth_method?: string;
  scope?: string;
}

const OAuthDynamicClientRegistrationRequestSchema = z
  .object({
    redirect_uris: z.array(z.string().trim().min(1).max(2_048)).min(1).max(10),
    client_name: z.string().trim().min(1).max(255).optional(),
    grant_types: z.array(z.string().trim().min(1).max(64)).max(4).optional(),
    response_types: z.array(z.string().trim().min(1).max(64)).max(4).optional(),
    token_endpoint_auth_method: z.string().trim().min(1).max(64).optional(),
    scope: z.string().trim().max(512).optional(),
  })
  .strict();

export interface OAuthDynamicClientRegistrationResponse {
  client_id: string;
  client_id_issued_at: number;
  client_name?: string;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  token_endpoint_auth_method: 'none';
  scope: string;
  expires_at: number;
}

const DYNAMIC_CLIENT_TTL_MS = 24 * 60 * 60 * 1_000;

@Injectable()
export class OAuthDynamicClientService {
  constructor(
    private readonly config: OAuthConfigService,
    private readonly clientRegistry: OAuthClientRegistry,
    private readonly redirectUriPolicy: OAuthRedirectUriPolicy,
    private readonly registrationRateLimiter: OAuthRegistrationRateLimiterService
  ) {}

  async register(
    request: OAuthDynamicClientRegistrationRequest,
    resource: string,
    sourceKey = 'unknown'
  ): Promise<OAuthDynamicClientRegistrationResponse> {
    if (!this.config.isDynamicClientRegistrationEnabled) {
      throw new BadRequestException('Dynamic Client Registration is disabled');
    }

    const parsedRequest = OAuthDynamicClientRegistrationRequestSchema.safeParse(request);
    if (!parsedRequest.success) {
      throw new BadRequestException('Invalid dynamic client registration request');
    }
    const validRequest = parsedRequest.data;

    const redirectUris = this.redirectUriPolicy.validate(validRequest.redirect_uris);
    const redirectOriginKey = this.redirectOriginKey(validRequest.redirect_uris);
    await this.registrationRateLimiter.assertAllowed(sourceKey, resource, redirectOriginKey);

    const responseTypes = validRequest.response_types ?? ['code'];
    if (responseTypes.some(value => value !== 'code')) {
      throw new BadRequestException('response_types supports only code');
    }

    const grantTypes = validRequest.grant_types ?? ['authorization_code'];
    if (grantTypes.some(value => value !== 'authorization_code' && value !== 'refresh_token')) {
      throw new BadRequestException('unsupported grant_type');
    }

    if ((validRequest.token_endpoint_auth_method ?? 'none') !== 'none') {
      throw new BadRequestException('token_endpoint_auth_method supports only none');
    }

    const scopes = validRequest.scope
      ? this.parseScope(validRequest.scope)
      : [...this.config.scopes];
    try {
      await this.clientRegistry.removeExpired();
    } catch {
      // Cleanup is opportunistic; registration must remain available if a legacy
      // database has not received the expiry migration yet.
    }
    const clientId = `mcp_dyn_${randomUUID().replaceAll('-', '')}`;
    const expiresAt = new Date(Date.now() + DYNAMIC_CLIENT_TTL_MS);
    const client = await this.clientRegistry.register({
      clientId,
      clientName: validRequest.client_name,
      resource,
      redirectUris,
      scopes,
      createdAt: new Date(),
      expiresAt,
    });

    return {
      client_id: client.clientId,
      client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
      client_name: client.clientName,
      redirect_uris: client.redirectUris,
      grant_types: grantTypes,
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      scope: client.scopes.join(' '),
      expires_at: Math.floor(expiresAt.getTime() / 1000),
    };
  }

  private redirectOriginKey(redirectUris: string[]): string {
    return redirectUris
      .map(uri => {
        try {
          return new URL(uri).origin;
        } catch {
          return 'invalid';
        }
      })
      .sort()
      .join(',');
  }

  private parseScope(scope: string): McpScope[] {
    const scopes = scope.split(/\s+/).filter(Boolean);
    if (scopes.length === 0) {
      throw new BadRequestException('scope must not be empty');
    }
    for (const value of scopes) {
      if (!this.config.scopes.includes(value as McpScope)) {
        throw new BadRequestException(`unsupported scope: ${value}`);
      }
    }
    return scopes as McpScope[];
  }
}
