import express from 'express';
import request from 'supertest';
import type { AddressInfo } from 'node:net';
import { z } from 'zod';
import type { McpAuthContext } from '../auth/mcp-auth-context';
import { McpConfigService } from '../config/mcp.config';
import { McpInstructionsService } from '../instructions/mcp-instructions.service';
import { MCP_SYSTEM_INSTRUCTIONS } from '../instructions/mcp-system-instructions';
import { jsonToolResult, type McpToolDefinition } from '../tools/mcp-tool.definition';
import { McpToolRegistry } from '../tools/mcp-tool.registry';
import { McpSdkServerFactory } from './mcp-sdk-server.factory';
import { McpStreamableHttpTransportHandler } from './mcp-streamable-http-transport.handler';

const version = '2026-07-28';
const context: McpAuthContext = {
  clientId: 'mcp-client-1',
  userId: 'user-1',
  projectId: 'project-1',
  roles: ['admin'],
  resource: 'https://digitalreport.p2pdigital.io.vn/mcp',
  scopes: ['mcp:read'],
  authFlow: 'mcp',
};

function modernBody(method: string, params: Record<string, unknown> = {}) {
  return {
    jsonrpc: '2.0',
    id: 1,
    method,
    params: {
      ...params,
      _meta: {
        'io.modelcontextprotocol/protocolVersion': version,
        'io.modelcontextprotocol/clientCapabilities': {},
        'io.modelcontextprotocol/clientInfo': { name: 'test-client', version: '1.0.0' },
      },
    },
  };
}

function rpcResult(res: request.Response) {
  if (res.headers['content-type']?.startsWith('text/event-stream')) {
    const data = res.text.split('\n').find(line => line.startsWith('data: '));
    return JSON.parse(data!.slice(6));
  }
  return res.body;
}

describe('McpStreamableHttpTransportHandler protocol integration', () => {
  const toolHandler = jest.fn(async (input: unknown, ctx: McpAuthContext, _signal?: AbortSignal) =>
    jsonToolResult({ projectId: ctx.projectId, input })
  );
  const wrap = jest.fn((_name: string, handler: (...args: unknown[]) => unknown) => handler);
  let app: express.Express;

  beforeEach(() => {
    jest.clearAllMocks();
    const tools: McpToolDefinition[] = [
      {
        name: 'write_test',
        description: 'Write',
        zodSchema: {},
        requiredScopes: ['mcp:write'],
        handler: toolHandler,
      },
      {
        name: 'echo_context',
        description: 'Read context',
        zodSchema: { value: z.string().trim().min(1).default('default') },
        requiredScopes: ['mcp:read'],
        handler: toolHandler,
        outputSchema: { projectId: z.string(), input: z.unknown() },
      },
    ];
    const factory = new McpSdkServerFactory(
      new McpConfigService({ get: jest.fn() } as never),
      new McpToolRegistry(tools),
      { wrap } as never
    );
    const handler = new McpStreamableHttpTransportHandler(factory, new McpInstructionsService());
    app = express();
    app.use(express.json());
    app.all('/mcp', async (req, res, next) => {
      try {
        await handler.handleRequest(req, res, req.body, {
          ...context,
          projectId: req.header('x-test-project') ?? context.projectId,
        });
      } catch (error) {
        next(error);
      }
    });
  });

  function post(method: string, params: Record<string, unknown> = {}) {
    const req = request(app)
      .post('/mcp')
      .set('Accept', 'application/json, text/event-stream')
      .set('MCP-Protocol-Version', version)
      .set('Mcp-Method', method);
    if (typeof params.name === 'string') req.set('Mcp-Name', params.name);
    return req.send(modernBody(method, params));
  }

  it('discovers modern capabilities, private cache policy, identity and language instructions', async () => {
    const res = await post('server/discover');
    expect(res.status).toBe(200);
    expect(res.body.result).toMatchObject({
      resultType: 'complete',
      supportedVersions: [version],
      instructions: MCP_SYSTEM_INSTRUCTIONS,
      ttlMs: 0,
      cacheScope: 'private',
      _meta: { 'io.modelcontextprotocol/serverInfo': { name: 'owox-mcp', version: '0.1.0' } },
    });
    expect(Object.keys(res.body.result.capabilities)).toEqual(['tools']);
    expect(res.headers['mcp-session-id']).toBeUndefined();
  });

  it('lists deterministically and calls a validated tool without an initialize handshake', async () => {
    const list = await post('tools/list');
    expect(list.status).toBe(200);
    expect(list.body.result).toMatchObject({
      resultType: 'complete',
      ttlMs: 0,
      cacheScope: 'private',
    });
    expect(list.body.result.tools.map((tool: { name: string }) => tool.name)).toEqual([
      'echo_context',
      'write_test',
    ]);
    expect(list.body.result.tools[0].inputSchema.properties.value.type).toBe('string');
    const call = await post('tools/call', {
      name: 'echo_context',
      arguments: { value: '  text  ' },
    });
    expect(call.status).toBe(200);
    expect(call.body.result).toMatchObject({
      resultType: 'complete',
      structuredContent: { projectId: 'project-1', input: { value: 'text' } },
    });
    expect(toolHandler).toHaveBeenCalledWith({ value: 'text' }, context, expect.any(AbortSignal));
  });

  it('preserves legacy initialize instructions and stateless tool calls', async () => {
    const init = await request(app)
      .post('/mcp')
      .set('Accept', 'application/json, text/event-stream')
      .send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-11-25',
          capabilities: {},
          clientInfo: { name: 'legacy', version: '1' },
        },
      });
    expect(init.status).toBe(200);
    expect(rpcResult(init).result).toMatchObject({
      protocolVersion: '2025-11-25',
      instructions: MCP_SYSTEM_INSTRUCTIONS,
    });
    expect(rpcResult(init).result.resultType).toBeUndefined();
    const call = await request(app)
      .post('/mcp')
      .set('Accept', 'application/json, text/event-stream')
      .set('MCP-Protocol-Version', '2025-11-25')
      .send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'echo_context', arguments: {} },
      });
    expect(call.status).toBe(200);
    expect(rpcResult(call).result.structuredContent).toEqual({
      projectId: 'project-1',
      input: { value: 'default' },
    });
    expect(rpcResult(call).result.resultType).toBeUndefined();
  });

  it.each(['MCP-Protocol-Version', 'Mcp-Method', 'Mcp-Name'])(
    'rejects a missing %s on a modern tool call',
    async header => {
      const res = await post('tools/call', { name: 'echo_context', arguments: {} }).unset(header);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(-32020);
      expect(toolHandler).not.toHaveBeenCalled();
    }
  );

  it.each([
    ['Mcp-Method', 'tools/list'],
    ['Mcp-Name', 'other_tool'],
    ['MCP-Protocol-Version', '2025-11-25'],
  ])('rejects a mismatching %s', async (header, value) => {
    const res = await post('tools/call', { name: 'echo_context', arguments: {} }).set(
      header,
      value
    );
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(-32020);
    expect(toolHandler).not.toHaveBeenCalled();
  });

  it('rejects unsupported revisions with the supported and requested versions', async () => {
    const body = modernBody('server/discover');
    body.params._meta['io.modelcontextprotocol/protocolVersion'] = '2099-01-01';
    const res = await request(app)
      .post('/mcp')
      .set('Accept', 'application/json, text/event-stream')
      .set('MCP-Protocol-Version', '2099-01-01')
      .set('Mcp-Method', 'server/discover')
      .send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({
      code: -32022,
      data: { supported: [version], requested: '2099-01-01' },
    });
  });

  it('rejects unknown modern methods', async () => {
    const res = await post('unknown/method');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe(-32601);
  });

  it.each([
    'null',
    'https://evil.example',
    'https://digitalreport.p2pdigital.io.vn.evil.example',
    'invalid',
  ])('rejects untrusted Origin %s', async origin => {
    const res = await post('server/discover').set('Origin', origin);
    expect(res.status).toBe(403);
    expect(toolHandler).not.toHaveBeenCalled();
  });

  it('accepts the exact authenticated resource Origin', async () => {
    expect(
      (await post('server/discover').set('Origin', new URL(context.resource).origin)).status
    ).toBe(200);
  });

  it('keeps per-request tenant context isolated under concurrency', async () => {
    const results = await Promise.all(
      ['project-a', 'project-b'].map(projectId =>
        post('tools/call', { name: 'echo_context', arguments: {} }).set('x-test-project', projectId)
      )
    );
    expect(results.map(res => res.body.result.structuredContent.projectId)).toEqual([
      'project-a',
      'project-b',
    ]);
  });

  it('does not execute tools outside the authenticated scopes or with invalid input', async () => {
    const denied = await post('tools/call', { name: 'write_test', arguments: {} });
    expect(denied.body.result.isError).toBe(true);
    expect(toolHandler).not.toHaveBeenCalled();
    const invalid = await post('tools/call', { name: 'echo_context', arguments: { value: 1 } });
    expect(invalid.body.result.isError).toBe(true);
    expect(toolHandler).not.toHaveBeenCalled();
  });

  it.each(['get', 'delete'] as const)('declines %s session operations', async method => {
    const res = await request(app)
      [method]('/mcp')
      .set('Accept', 'application/json, text/event-stream');
    expect(res.status).toBe(405);
  });

  it.each(['modern', 'legacy'])(
    'propagates %s client disconnect to the tool abort signal',
    async era => {
      let entered!: () => void;
      let cancelled!: () => void;
      const started = new Promise<void>(resolve => {
        entered = resolve;
      });
      const aborted = new Promise<void>(resolve => {
        cancelled = resolve;
      });
      toolHandler.mockImplementationOnce(async (_input, _context, signal) => {
        entered();
        await new Promise<void>(resolve => {
          signal!.addEventListener(
            'abort',
            () => {
              cancelled();
              resolve();
            },
            { once: true }
          );
        });
        return jsonToolResult({ cancelled: true });
      });
      const server = app.listen(0, '127.0.0.1');
      await new Promise<void>(resolve => server.once('listening', resolve));
      const controller = new AbortController();
      const body =
        era === 'modern'
          ? modernBody('tools/call', { name: 'echo_context', arguments: {} })
          : {
              jsonrpc: '2.0',
              id: 1,
              method: 'tools/call',
              params: { name: 'echo_context', arguments: {} },
            };
      const pending = fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/mcp`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          'MCP-Protocol-Version': era === 'modern' ? version : '2025-11-25',
          'Mcp-Method': 'tools/call',
          'Mcp-Name': 'echo_context',
        },
        body: JSON.stringify(body),
      })
        .then(async res => {
          await res.text();
        })
        .catch(() => undefined);
      try {
        await started;
        controller.abort();
        await aborted;
        await pending;
      } finally {
        controller.abort();
        server.closeAllConnections();
        await new Promise<void>((resolve, reject) =>
          server.close(error => (error ? reject(error) : resolve()))
        );
      }
    },
    10000
  );
});
