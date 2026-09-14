import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { McpScope } from '@owox/idp-protocol';
import { OAuthClientRegistry } from './oauth-client.registry';
import { OAuthConfigService } from './oauth-config.service';
import { OAuthRedirectUriPolicy } from './oauth-redirect-uri.policy';

export interface OAuthDynamicClientRegistrationRequest {
  redirect_uris?: string[];
  client_name?: string;
  grant_types?: string[];
  response_types?: string[];
  token_endpoint_auth_method?: string;
  scope?: string;
}

export interface OAuthDynamicClientRegistrationResponse {
  client_id: string;
  client_id_issued_at: number;
  client_name?: string;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  token_endpoint_auth_method: 'none';
  scope: string;
}

@Injectable()
export class OAuthDynamicClientService {
  constructor(
    private readonly config: OAuthConfigService,
    private readonly clientRegistry: OAuthClientRegistry,
    private readonly redirectUriPolicy: OAuthRedirectUriPolicy
  ) {}

  async register(
    request: OAuthDynamicClientRegistrationRequest,
    resource: string
  ): Promise<OAuthDynamicClientRegistrationResponse> {
    if (!this.config.isDynamicClientRegistrationEnabled) {
      throw new BadRequestException('Dynamic Client Registration is disabled');
    }

    const redirectUris = this.redirectUriPolicy.validate(request.redirect_uris ?? []);

    const responseTypes = request.response_types ?? ['code'];
    if (responseTypes.some(value => value !== 'code')) {
      throw new BadRequestException('response_types supports only code');
    }

    const grantTypes = request.grant_types ?? ['authorization_code'];
    if (grantTypes.some(value => value !== 'authorization_code' && value !== 'refresh_token')) {
      throw new BadRequestException('unsupported grant_type');
    }

    if ((request.token_endpoint_auth_method ?? 'none') !== 'none') {
      throw new BadRequestException('token_endpoint_auth_method supports only none');
    }

    const scopes = request.scope ? this.parseScope(request.scope) : [...this.config.scopes];
    const clientId = `mcp_dyn_${randomUUID().replaceAll('-', '')}`;
    const client = await this.clientRegistry.register({
      clientId,
      clientName: request.client_name,
      resource,
      redirectUris,
      scopes,
      createdAt: new Date(),
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
    };
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
