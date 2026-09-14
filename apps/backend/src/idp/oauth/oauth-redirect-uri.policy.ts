import { BadRequestException, Injectable } from '@nestjs/common';
import { OAuthConfigService } from './oauth-config.service';

@Injectable()
export class OAuthRedirectUriPolicy {
  constructor(private readonly config: OAuthConfigService) {}

  validate(redirectUris: readonly string[]): string[] {
    if (redirectUris.length === 0) {
      throw new BadRequestException('redirect_uris must contain at least one URI');
    }
    if (redirectUris.length > this.config.maxRedirectUris) {
      throw new BadRequestException('too many redirect_uris');
    }

    for (const redirectUri of redirectUris) {
      this.assertAllowed(redirectUri);
    }

    return [...redirectUris];
  }

  assertAllowed(raw: string): void {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new BadRequestException('redirect_uri must be a valid URL');
    }

    if (this.isLoopbackHttpRedirect(url)) {
      return;
    }

    if (url.protocol === 'https:' && this.config.allowedRedirectOrigins.includes(url.origin)) {
      return;
    }

    if (url.protocol === 'https:') {
      throw new BadRequestException(
        `redirect_uri origin is not allowlisted. Add to MCP_DYNAMIC_CLIENT_ALLOWED_REDIRECT_ORIGINS: ${url.origin}`
      );
    }

    throw new BadRequestException('redirect_uri must be loopback http or allowlisted https origin');
  }

  private isLoopbackHttpRedirect(url: URL): boolean {
    return (
      url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(url.hostname)
    );
  }
}
