import { Injectable, Logger } from '@nestjs/common';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { toNodeHandler } from '@modelcontextprotocol/node';
import type { Request, Response } from 'express';
import type { McpAuthContext } from '../auth/mcp-auth-context';
import { McpInstructionsService } from '../instructions/mcp-instructions.service';
import { McpSdkServerFactory } from './mcp-sdk-server.factory';

@Injectable()
export class McpStreamableHttpTransportHandler {
  private readonly logger = new Logger(McpStreamableHttpTransportHandler.name);

  constructor(
    private readonly serverFactory: McpSdkServerFactory,
    private readonly instructionsService: McpInstructionsService
  ) {}

  async handleRequest(
    request: Request,
    response: Response,
    body: unknown,
    context: McpAuthContext
  ): Promise<void> {
    // Native clients omit Origin. Browser origins must exactly match the authenticated resource;
    // never derive this allowlist from untrusted Host or forwarded headers.
    const origin = request.headers.origin;
    if (origin !== undefined && origin !== new URL(context.resource).origin) {
      response.status(403).json({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32000, message: 'Invalid MCP Origin' },
      });
      return;
    }

    // Legacy pre-2025 clients may omit this header. A modern envelope must always mirror it.
    const message = body as { id?: unknown; params?: { _meta?: Record<string, unknown> } } | null;
    const metadata = message?.params?._meta;
    if (
      metadata &&
      typeof metadata === 'object' &&
      'io.modelcontextprotocol/protocolVersion' in metadata &&
      request.headers['mcp-protocol-version'] === undefined
    ) {
      response.status(400).json({
        jsonrpc: '2.0',
        id: typeof message.id === 'string' || typeof message.id === 'number' ? message.id : null,
        error: { code: -32020, message: 'Missing required MCP-Protocol-Version header' },
      });
      return;
    }

    const handler = createMcpHandler(
      () => this.serverFactory.create(context, this.instructionsService.getInstructions()),
      {
        legacy: 'stateless',
        responseMode: 'auto',
        onerror: error => {
          this.logger.warn('MCP SDK handler error', {
            errorType: error.name,
            method: request.method,
            projectId: context.projectId,
            clientId: context.clientId,
          });
        },
      }
    );

    try {
      // The SDK owns era negotiation, header checks, result envelopes and per-request cleanup.
      // Passing the parsed body avoids rereading the stream consumed by Nest/Express.
      await toNodeHandler(handler)(request, response, body);
    } finally {
      await handler.close();
    }
  }
}
