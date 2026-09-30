import {
  BadRequestException,
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { recordOperationalMetric } from '../../../common/observability/operational-metric';
import { McpResourceResolverService } from '../../../mcp-resource/mcp-resource-resolver.service';
import {
  OAuthDynamicClientRegistrationRequest,
  OAuthDynamicClientService,
} from '../oauth-dynamic-client.service';
import { OAuthConfigService } from '../oauth-config.service';

@Controller('/oauth')
export class OAuthRegistrationController {
  private readonly logger = new Logger(OAuthRegistrationController.name);

  constructor(
    private readonly dynamicClientService: OAuthDynamicClientService,
    private readonly resourceResolver: McpResourceResolverService,
    private readonly config: OAuthConfigService
  ) {}

  @Post('/register')
  register(@Body() body: OAuthDynamicClientRegistrationRequest, @Req() request: Request) {
    const resourceContext = this.resourceResolver.tryResolveRequest(request);
    const resource =
      resourceContext?.resource ?? this.getSharedResourceForAuthorizationServer(request);
    if (!resource) {
      recordOperationalMetric(this.logger, 'oauth_registration', 'rejected');
      throw new BadRequestException('dynamic client registration requires an MCP resource host');
    }

    const sourceKey = this.getRequestIp(request);
    return this.dynamicClientService.register(body, resource, sourceKey).then(
      result => {
        recordOperationalMetric(this.logger, 'oauth_registration', 'accepted');
        return result;
      },
      error => {
        const outcome =
          error instanceof HttpException && error.getStatus() === HttpStatus.TOO_MANY_REQUESTS
            ? 'rate_limited'
            : error instanceof HttpException && error.getStatus() < HttpStatus.INTERNAL_SERVER_ERROR
              ? 'rejected'
              : 'failed';
        recordOperationalMetric(this.logger, 'oauth_registration', outcome);
        throw error;
      }
    );
  }

  private getRequestIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    const firstForwarded = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0];
    return (request.ip ?? request.socket?.remoteAddress ?? firstForwarded ?? 'unknown').trim();
  }

  private getSharedResourceForAuthorizationServer(request: Request): string | null {
    const host = request.host ?? request.headers.host;
    if (!host) {
      return null;
    }

    try {
      const requestOrigin = new URL(`${request.protocol ?? 'https'}://${host}`).origin;
      return requestOrigin === new URL(this.config.issuer).origin ? this.config.resource : null;
    } catch {
      return null;
    }
  }
}
