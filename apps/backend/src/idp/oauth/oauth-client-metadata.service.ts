import { BadRequestException, Injectable } from '@nestjs/common';
import { fetchPublicUrl } from '../../common/helpers/safe-url.helper';
import { OAuthConfigService } from './oauth-config.service';
import { OAuthRedirectUriPolicy } from './oauth-redirect-uri.policy';
import type { OAuthRegisteredClient } from './oauth-client.registry';
import type { McpScope } from '@owox/idp-protocol';
import { z } from 'zod';

const MAX_METADATA_DOCUMENT_BYTES = 64 * 1024;
const CLIENT_METADATA_URL_PATTERN = /^https?:\/\//i;

const OAuthClientMetadataDocumentSchema = z.object({
  client_id: z.string().min(1),
  client_name: z.string().refine(value => value.trim().length > 0),
  redirect_uris: z.array(z.string().min(1)).min(1),
  grant_types: z.array(z.string().min(1)).optional(),
  response_types: z.array(z.string().min(1)).optional(),
  token_endpoint_auth_method: z.string().min(1).optional(),
  token_endpoint_auth_methods_supported: z.array(z.string().min(1)).min(1).optional(),
  scope: z.string().optional(),
});

type OAuthClientMetadataDocument = z.infer<typeof OAuthClientMetadataDocumentSchema>;

interface MetadataCacheEntry {
  client: OAuthRegisteredClient;
  expiresAt: number;
}

export function looksLikeClientMetadataId(value: string): boolean {
  return CLIENT_METADATA_URL_PATTERN.test(value);
}

export function isClientMetadataId(value: string): boolean {
  if (!looksLikeClientMetadataId(value)) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.pathname !== '' && url.pathname !== '/';
  } catch {
    return false;
  }
}

@Injectable()
export class OAuthClientMetadataService {
  private readonly cache = new Map<string, MetadataCacheEntry>();

  constructor(
    private readonly config: OAuthConfigService,
    private readonly redirectUriPolicy: OAuthRedirectUriPolicy
  ) {}

  async resolve(clientId: string): Promise<OAuthRegisteredClient | undefined> {
    if (!looksLikeClientMetadataId(clientId)) {
      return undefined;
    }
    if (!this.config.clientMetadataDocumentEnabled) {
      throw new BadRequestException('Client ID Metadata Documents are disabled');
    }

    const cached = this.cache.get(clientId);
    if (cached) {
      if (cached.expiresAt > Date.now()) {
        this.cache.delete(clientId);
        this.cache.set(clientId, cached);
        return cached.client;
      }
      this.cache.delete(clientId);
    }

    const metadata = await this.fetchMetadata(clientId);
    const client: OAuthRegisteredClient = {
      clientId: metadata.client_id,
      clientName: metadata.client_name,
      redirectUris: metadata.redirect_uris,
      scopes: this.parseScopes(metadata.scope),
      status: 'pending',
      createdAt: new Date(),
    };

    const ttlMs = this.cacheTtlMs(metadata.cacheControl, metadata.expires);
    if (ttlMs > 0) {
      this.cache.set(clientId, {
        client,
        expiresAt: Date.now() + ttlMs,
      });
      this.trimCache();
    }

    return client;
  }

  private async fetchMetadata(clientId: string): Promise<
    OAuthClientMetadataDocument & {
      cacheControl: string | null;
      expires: string | null;
    }
  > {
    let clientUrl: URL;
    try {
      clientUrl = new URL(clientId);
    } catch {
      throw new BadRequestException('client_id must be a valid HTTPS metadata URL');
    }

    if (
      clientUrl.protocol !== 'https:' ||
      clientUrl.pathname === '' ||
      clientUrl.pathname === '/' ||
      clientUrl.username ||
      clientUrl.password ||
      clientUrl.hash
    ) {
      throw new BadRequestException('client_id must be a valid HTTPS metadata URL');
    }

    if (
      this.config.clientMetadataAllowedOrigins.length > 0 &&
      !this.config.clientMetadataAllowedOrigins.includes(clientUrl.origin)
    ) {
      throw new BadRequestException(
        `client metadata origin is not allowlisted: ${clientUrl.origin}`
      );
    }

    const controller = new AbortController();
    const timeoutHandle = setTimeout(
      () => controller.abort(),
      this.config.clientMetadataFetchTimeoutMs
    );
    try {
      let response: Response;
      try {
        response = await this.awaitWithAbort(
          fetchPublicUrl(
            clientId,
            {
              headers: {
                Accept: 'application/json',
                'User-Agent': 'owox-data-marts-mcp-oauth',
              },
              signal: controller.signal,
            },
            {
              allowedProtocols: ['https:'],
              allowedOrigins: [clientUrl.origin],
            }
          ),
          controller.signal
        );
      } catch {
        throw new BadRequestException('client metadata document could not be fetched');
      }

      if (!response.ok) {
        throw new BadRequestException('client metadata document could not be fetched');
      }

      const contentType = response.headers.get('content-type');
      if (contentType && !/^application\/(?:json|.+\+json)(?:\s*;|$)/i.test(contentType)) {
        throw new BadRequestException('client metadata document must be JSON');
      }

      const document = await this.readDocument(response, controller.signal);
      const metadata = this.parseDocument(document, clientId);
      return {
        ...metadata,
        cacheControl: response.headers.get('cache-control'),
        expires: response.headers.get('expires'),
      };
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  private async readDocument(response: Response, signal: AbortSignal): Promise<string> {
    const contentLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > MAX_METADATA_DOCUMENT_BYTES) {
      await response.body?.cancel().catch(() => undefined);
      throw new BadRequestException('client metadata document is too large');
    }

    if (!response.body) {
      const text = await this.awaitWithAbort(response.text(), signal);
      if (Buffer.byteLength(text, 'utf8') > MAX_METADATA_DOCUMENT_BYTES) {
        throw new BadRequestException('client metadata document is too large');
      }
      return text;
    }

    const reader = response.body.getReader();
    const chunks: Buffer[] = [];
    let totalBytes = 0;

    try {
      while (true) {
        const { done, value } = await this.awaitWithAbort(reader.read(), signal);
        if (done) {
          break;
        }
        totalBytes += value.byteLength;
        if (totalBytes > MAX_METADATA_DOCUMENT_BYTES) {
          throw new BadRequestException('client metadata document is too large');
        }
        chunks.push(Buffer.from(value));
      }
    } catch (error) {
      await reader.cancel().catch(() => undefined);
      throw error;
    } finally {
      reader.releaseLock();
    }

    return Buffer.concat(chunks).toString('utf8');
  }

  private awaitWithAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
    if (signal.aborted) {
      return Promise.reject(new BadRequestException('client metadata document fetch timed out'));
    }

    return new Promise<T>((resolve, reject) => {
      let settled = false;
      const onAbort = () => {
        if (settled) {
          return;
        }
        settled = true;
        reject(new BadRequestException('client metadata document fetch timed out'));
      };
      const cleanup = () => {
        signal.removeEventListener('abort', onAbort);
      };

      signal.addEventListener('abort', onAbort, { once: true });
      promise.then(
        value => {
          if (settled) {
            return;
          }
          settled = true;
          cleanup();
          resolve(value);
        },
        error => {
          if (settled) {
            return;
          }
          settled = true;
          cleanup();
          reject(error);
        }
      );
    });
  }

  private parseDocument(raw: string, requestedClientId: string): OAuthClientMetadataDocument {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new BadRequestException('client metadata document must be valid JSON');
    }

    const parsedDocument = OAuthClientMetadataDocumentSchema.safeParse(parsed);
    if (!parsedDocument.success) {
      throw new BadRequestException('client metadata document has an invalid shape');
    }

    const value = parsedDocument.data;
    const clientId = value.client_id;
    const clientName = value.client_name.trim();
    if (clientId !== requestedClientId) {
      throw new BadRequestException('client metadata client_id does not match request');
    }

    const redirectUris = this.redirectUriPolicy.validate(value.redirect_uris);
    const grantTypes = value.grant_types ?? ['authorization_code'];
    if (
      grantTypes.some(value => value !== 'authorization_code' && value !== 'refresh_token') ||
      !grantTypes.includes('authorization_code')
    ) {
      throw new BadRequestException('client metadata grant_types must support authorization_code');
    }

    const responseTypes = value.response_types ?? ['code'];
    if (responseTypes.some(value => value !== 'code') || !responseTypes.includes('code')) {
      throw new BadRequestException('client metadata response_types supports only code');
    }

    // Plural metadata describes capabilities; the legacy singular field is a preference.
    const authMethods = value.token_endpoint_auth_methods_supported ?? [
      value.token_endpoint_auth_method ?? 'none',
    ];
    if (!authMethods.includes('none')) {
      throw new BadRequestException(
        'client metadata token_endpoint_auth_method supports only none'
      );
    }

    return {
      client_id: clientId,
      client_name: clientName,
      redirect_uris: redirectUris,
      grant_types: grantTypes,
      response_types: responseTypes,
      token_endpoint_auth_method: 'none',
      scope: value.scope,
    };
  }

  private parseScopes(scope: string | undefined): McpScope[] {
    const values =
      scope === undefined ? [...this.config.scopes] : scope.split(/\s+/).filter(Boolean);
    if (values.length === 0) {
      throw new BadRequestException('client metadata scope must not be empty');
    }
    for (const value of values) {
      if (!this.config.scopes.includes(value as McpScope)) {
        throw new BadRequestException(`unsupported scope: ${value}`);
      }
    }
    return values as McpScope[];
  }

  private cacheTtlMs(cacheControl: string | null, expires: string | null): number {
    const directives = (cacheControl ?? '')
      .split(',')
      .map(value => value.trim().toLowerCase())
      .filter(Boolean);
    if (
      directives.some(
        directive =>
          directive === 'no-store' || directive === 'no-cache' || directive.startsWith('no-cache=')
      )
    ) {
      return 0;
    }

    const maxAge = directives.find(directive => directive.startsWith('max-age='));
    if (maxAge) {
      const seconds = Number(maxAge.slice('max-age='.length).trim().replace(/^"|"$/g, ''));
      if (Number.isFinite(seconds) && seconds >= 0) {
        return Math.min(seconds * 1000, this.config.clientMetadataCacheMaxTtlMs);
      }
    }

    if (expires) {
      const expiresAt = Date.parse(expires);
      if (Number.isFinite(expiresAt)) {
        return Math.min(
          Math.max(0, expiresAt - Date.now()),
          this.config.clientMetadataCacheMaxTtlMs
        );
      }
    }

    return Math.min(this.config.clientMetadataCacheTtlMs, this.config.clientMetadataCacheMaxTtlMs);
  }

  private trimCache(): void {
    while (this.cache.size > this.config.clientMetadataCacheMaxEntries) {
      const oldest = this.cache.keys().next().value;
      if (oldest === undefined) {
        return;
      }
      this.cache.delete(oldest);
    }
  }
}
