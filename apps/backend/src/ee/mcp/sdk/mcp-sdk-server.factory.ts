import { Injectable } from '@nestjs/common';
import {
  McpServer,
  type StandardSchemaWithJSON,
  type ServerContext,
} from '@modelcontextprotocol/server';
import type { ToolAnnotations } from '@modelcontextprotocol/server';
import type { McpScope } from '@owox/idp-protocol';
import { z } from 'zod';
import type { ZodRawShape } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { McpAuthContext } from '../auth/mcp-auth-context';
import { McpConfigService } from '../config/mcp.config';
import { McpCallInstrumentation } from '../observability/mcp-call-instrumentation';
import type { McpToolResult } from '../tools/mcp-tool.definition';
import { McpToolRegistry } from '../tools/mcp-tool.registry';

type McpSdkToolRegistrar = {
  registerTool(
    name: string,
    config: {
      description: string;
      inputSchema: StandardSchemaWithJSON;
      outputSchema?: StandardSchemaWithJSON;
      annotations?: ToolAnnotations;
    },
    callback: (input: unknown, extra: ServerContext) => Promise<McpToolResult>
  ): unknown;
};

@Injectable()
export class McpSdkServerFactory {
  private readonly schemaCache = new WeakMap<ZodRawShape, StandardSchemaWithJSON>();

  constructor(
    private readonly config: McpConfigService,
    private readonly toolRegistry: McpToolRegistry,
    private readonly instrumentation: McpCallInstrumentation
  ) {}

  create(mcpContext: McpAuthContext, instructions?: string): McpServer {
    const serverInfo = {
      name: this.config.serverName,
      version: this.config.serverVersion,
    };
    const server = new McpServer(serverInfo, {
      ...(instructions ? { instructions } : {}),
      // Keep the deployed legacy revisions while explicitly enabling the 2026 modern era.
      supportedProtocolVersions: [
        '2026-07-28',
        '2025-11-25',
        '2025-06-18',
        '2025-03-26',
        '2024-11-05',
        '2024-10-07',
      ],
      capabilities: { tools: { listChanged: false } },
      cacheHints: {
        'server/discover': { ttlMs: 0, cacheScope: 'private' },
        'tools/list': { ttlMs: 0, cacheScope: 'private' },
      },
    });

    const sdkToolRegistrar = server as unknown as McpSdkToolRegistrar;

    for (const tool of [...this.toolRegistry.getTools()].sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0
    )) {
      const wrapped = this.instrumentation.wrap(tool.name, async (input, extra) => {
        this.assertScopes(mcpContext, tool.requiredScopes);
        // extra.signal fires on client disconnect/cancel — thread it so an abandoned query stops
        // waiting and is recorded CANCELLED (not billed) instead of running to completion.
        return tool.handler(input, mcpContext, extra?.signal);
      });

      sdkToolRegistrar.registerTool(
        tool.name,
        {
          description: tool.description,
          inputSchema: this.toStandardSchema(tool.zodSchema),
          ...(tool.outputSchema ? { outputSchema: this.toStandardSchema(tool.outputSchema) } : {}),
          ...(tool.annotations ? { annotations: tool.annotations } : {}),
        },
        (input, ctx) =>
          wrapped(input, {
            signal: ctx?.mcpReq.signal,
            _meta: ctx?.mcpReq._meta,
          })
      );
    }

    return server;
  }

  private toStandardSchema(shape: ZodRawShape): StandardSchemaWithJSON {
    const cached = this.schemaCache.get(shape);
    if (cached) return cached;

    const objectSchema = z.object(shape);
    // Preserve Zod 3 refinements/transforms at the business boundary while exposing SDK v2's
    // Standard Schema interface. Conversion is cached across per-request server instances.
    const jsonSchema = zodToJsonSchema(objectSchema as never, {
      target: 'jsonSchema7',
      $refStrategy: 'none',
      strictUnions: true,
      pipeStrategy: 'input',
    });
    const standardSchema: StandardSchemaWithJSON = {
      '~standard': {
        version: 1,
        vendor: 'zod',
        validate: async value => {
          const result = await objectSchema.safeParseAsync(value);
          return result.success ? { value: result.data } : { issues: result.error.issues };
        },
        jsonSchema: {
          input: () => jsonSchema,
          output: () => jsonSchema,
        },
      },
    };
    this.schemaCache.set(shape, standardSchema);
    return standardSchema;
  }

  private assertScopes(context: McpAuthContext, requiredScopes: McpScope[]): void {
    for (const scope of requiredScopes) {
      if (!context.scopes.includes(scope)) {
        throw new Error(`Missing MCP scope: ${scope}`);
      }
    }
  }
}
