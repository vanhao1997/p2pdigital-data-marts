import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { recordOperationalMetric } from '../../common/observability/operational-metric';
import { AuthenticationError } from '@owox/idp-protocol';
import { OWOX_API_KEY_ID_HEADER } from '../../idp/openapi/authentication.openapi';
import { ExchangeProjectMemberApiKeyRequestApiDto } from '../dto/presentation/exchange-project-member-api-key-request-api.dto';
import { ExchangeProjectMemberApiKeyResponseApiDto } from '../dto/presentation/exchange-project-member-api-key-response-api.dto';
import {
  ApiKeyExchangeRateLimitError,
  ExchangeProjectMemberApiKeyService,
} from '../use-cases/exchange-project-member-api-key.service';

@ApiTags('Project Member API Keys')
@Controller('auth/api-keys')
export class ApiKeyExchangeController {
  private static readonly MAX_BODY_BYTES = 16 * 1024;
  private readonly logger = new Logger(ApiKeyExchangeController.name);

  constructor(
    private readonly exchangeProjectMemberApiKeyService: ExchangeProjectMemberApiKeyService
  ) {}

  @Post('exchange')
  @HttpCode(200)
  @ApiOperation({ summary: 'Exchange a project member API key for an ODM access token' })
  @ApiHeader({ name: OWOX_API_KEY_ID_HEADER, required: true })
  @ApiResponse({ status: 200, type: ExchangeProjectMemberApiKeyResponseApiDto })
  async exchange(
    @Headers('x-owox-api-key-id') apiKeyId: string | undefined,
    @Body() body: ExchangeProjectMemberApiKeyRequestApiDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ): Promise<ExchangeProjectMemberApiKeyResponseApiDto> {
    const contentLength = Number(request.headers['content-length'] ?? 0);
    if (Number.isFinite(contentLength) && contentLength > ApiKeyExchangeController.MAX_BODY_BYTES) {
      recordOperationalMetric(this.logger, 'api_key_exchange', 'failed');
      throw new HttpException('Request body too large', HttpStatus.PAYLOAD_TOO_LARGE);
    }
    try {
      const result = await this.exchangeProjectMemberApiKeyService.run({
        apiKeyId,
        apiKeySecret: body.apiKeySecret,
        ipAddress: request.ip ?? request.socket?.remoteAddress ?? 'unknown',
      });
      recordOperationalMetric(this.logger, 'api_key_exchange', 'success');
      return result;
    } catch (error) {
      if (error instanceof ApiKeyExchangeRateLimitError) {
        recordOperationalMetric(this.logger, 'api_key_exchange', 'rate_limited');
        response.setHeader('Retry-After', String(error.retryAfterSeconds));
        throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
      }
      recordOperationalMetric(
        this.logger,
        'api_key_exchange',
        error instanceof AuthenticationError ? 'unauthorized' : 'failed'
      );
      throw error;
    }
  }
}
