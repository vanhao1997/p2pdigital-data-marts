import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { McpScope } from '@owox/idp-protocol';

@Injectable()
export class OAuthConfigService {
  constructor(private readonly config: ConfigService) {}

  get issuer(): string {
    return this.requireConfig('OWOX_AUTH_PUBLIC_BASE_URL');
  }

  get mcpPublicBaseUrl(): string {
    return this.requireConfig('MCP_PUBLIC_BASE_URL');
  }

  get authorizationEndpoint(): string {
    return `${this.issuer}/oauth/authorize`;
  }

  get tokenEndpoint(): string {
    return `${this.issuer}/oauth/token`;
  }

  get registrationEndpoint(): string {
    return `${this.issuer}/oauth/register`;
  }

  get jwksEndpoint(): string {
    return `${this.issuer}/oauth/jwks`;
  }

  get resource(): string {
    return this.config.get<string>('MCP_OAUTH_RESOURCE') ?? `${this.mcpPublicBaseUrl}/mcp`;
  }

  get scopes(): McpScope[] {
    return ['mcp:read', 'mcp:write'];
  }

  get isDynamicClientRegistrationEnabled(): boolean {
    return this.readBoolean('MCP_DYNAMIC_CLIENT_REGISTRATION_ENABLED', true);
  }

  get clientMetadataDocumentEnabled(): boolean {
    return this.readBoolean('MCP_CLIENT_METADATA_DOCUMENT_ENABLED', true);
  }

  get clientMetadataAllowedOrigins(): string[] {
    return this.readHttpsOrigins('MCP_CLIENT_METADATA_ALLOWED_ORIGINS');
  }

  get clientMetadataCacheTtlMs(): number {
    return this.readBoundedNumber('MCP_CLIENT_METADATA_CACHE_TTL_MS', 300_000, 1_000, 86_400_000);
  }

  get clientMetadataCacheMaxTtlMs(): number {
    return this.readBoundedNumber(
      'MCP_CLIENT_METADATA_CACHE_MAX_TTL_MS',
      3_600_000,
      1_000,
      86_400_000
    );
  }

  get clientMetadataCacheMaxEntries(): number {
    return this.readBoundedNumber('MCP_CLIENT_METADATA_CACHE_MAX_ENTRIES', 256, 1, 10_000);
  }

  get clientMetadataFetchTimeoutMs(): number {
    return this.readBoundedNumber('MCP_CLIENT_METADATA_FETCH_TIMEOUT_MS', 5_000, 1_000, 60_000);
  }

  get allowedRedirectOrigins(): string[] {
    return this.readHttpsOrigins('MCP_DYNAMIC_CLIENT_ALLOWED_REDIRECT_ORIGINS');
  }

  get maxRedirectUris(): number {
    return this.readBoundedNumber('MCP_DYNAMIC_CLIENT_MAX_REDIRECT_URIS', 10, 1, 100);
  }

  private readHttpsOrigins(key: string): string[] {
    const value = this.config.get<unknown>(key);
    if (typeof value !== 'string') {
      return [];
    }

    const entries = value
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const origins = entries.map(entry => this.toHttpsOrigin(entry));
    const invalidIndex = origins.findIndex(origin => origin === null);
    if (invalidIndex !== -1) {
      throw new Error(`${key} must contain only valid HTTPS origins`);
    }

    return origins.filter((origin): origin is string => Boolean(origin));
  }

  private toHttpsOrigin(value: string): string | null {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password ? url.origin : null;
    } catch {
      return null;
    }
  }

  private readBoundedNumber(
    key: string,
    defaultValue: number,
    minimum: number,
    maximum: number
  ): number {
    const value = Number(this.config.get<unknown>(key) ?? defaultValue);
    if (!Number.isFinite(value)) {
      return defaultValue;
    }
    return Math.min(maximum, Math.max(minimum, Math.floor(value)));
  }

  private readBoolean(key: string, defaultValue: boolean): boolean {
    const value = this.config.get<unknown>(key);
    if (value === undefined || value === null || value === '') {
      return defaultValue;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      return value.trim().toLowerCase() !== 'false';
    }
    return defaultValue;
  }

  private requireConfig(key: 'OWOX_AUTH_PUBLIC_BASE_URL' | 'MCP_PUBLIC_BASE_URL'): string {
    const value = this.config.get<string>(key)?.trim();
    if (!value) {
      throw new Error(`${key} is required for MCP OAuth`);
    }
    return value;
  }
}
