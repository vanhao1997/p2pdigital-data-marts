import { Body, Controller, Header, HttpCode, Inject, Post, Req, UseFilters } from '@nestjs/common';
import type { Request } from 'express';
import { McpResourceResolverService } from '../../../mcp-resource/mcp-resource-resolver.service';
import { OAuthClientRegistry } from '../oauth-client.registry';
import { OAuthIdpPort, OAUTH_IDP_PORT } from '../oauth-idp.port';
import { OAuthRequestValidator } from '../oauth-request.validator';
import { isClientMetadataId } from '../oauth-client-metadata.service';
import { OAuthExceptionFilter } from '../oauth-exception.filter';

@Controller('/oauth')
@UseFilters(OAuthExceptionFilter)
export class OAuthTokenController {
  constructor(
    private readonly validator: OAuthRequestValidator,
    @Inject(OAUTH_IDP_PORT) private readonly oauthIdp: OAuthIdpPort,
    private readonly clientRegistry: OAuthClientRegistry,
    private readonly resourceResolver: McpResourceResolverService
  ) {}

  @Post('/token')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  async token(@Body() body: Record<string, unknown>, @Req() request: Request) {
    const requestResource = this.resourceResolver.tryResolveRequest(request)?.resource;
    const validated = await this.validator.validateTokenRequest(body, requestResource);
    const tokenRequest = validated.request;
    const result = await this.oauthIdp.exchangeToken(tokenRequest);
    if (!isClientMetadataId(tokenRequest.clientId)) {
      await this.clientRegistry.markSuccessfulTokenExchange(tokenRequest.clientId);
    }
    return result;
  }
}
