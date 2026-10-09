import type { INestApplication } from '@nestjs/common';
import type * as supertest from 'supertest';
import { closeTestApp, createTestApp } from '@owox/test-utils';
import { DataSource } from 'typeorm';
import { MCP_AUTH_PORT } from '../src/ee/mcp/auth/mcp-auth.port';
import { ValidateDataMartDefinitionService } from '../src/data-marts/use-cases/validate-data-mart-definition.service';
import { IdpProjectionsFacade } from '../src/idp/facades/idp-projections.facade';
import { UserProjectionsListDto } from '../src/idp/dto/domain/user-projections-list.dto';

const version = '2026-07-28';
const resource = 'https://digitalreport.p2pdigital.io.vn/mcp';
const canary = 'mcp-secret-canary-never-expose';

describe('MCP setup tools through the authenticated API (e2e)', () => {
  let app: INestApplication;
  let agent: supertest.Agent;
  let storageA: string;
  let storageB: string;
  let dataMartA: string;
  const validate = jest.fn().mockResolvedValue({ valid: true });
  const originalMcpOrigin = process.env.MCP_PUBLIC_BASE_URL;

  beforeAll(async () => {
    process.env.MCP_PUBLIC_BASE_URL = 'https://digitalreport.p2pdigital.io.vn';
    const fixture = await createTestApp([
      {
        provide: IdpProjectionsFacade,
        useValue: {
          getProjectMembers: async (projectId: string) =>
            ['project-a', 'project-b'].includes(projectId)
              ? [{ userId: 'fixture-user', isOutbound: false, role: 'admin' }]
              : [],
          getUserProjectionList: async () => new UserProjectionsListDto([]),
          getUserProjection: async () => undefined,
          getProjectProjection: async () => undefined,
        },
      },
      {
        provide: MCP_AUTH_PORT,
        useValue: {
          verifyToken: async (token: string) => {
            if (!['write-a', 'write-b', 'read-a', 'viewer-a'].includes(token)) return null;
            return {
              clientId: 'fixture-client',
              userId: 'fixture-user',
              projectId: token === 'write-b' ? 'project-b' : 'project-a',
              roles: token === 'viewer-a' ? ['viewer'] : ['admin'],
              scopes: token === 'read-a' ? ['mcp:read'] : ['mcp:read', 'mcp:write'],
              resource,
              authFlow: 'mcp',
            };
          },
        },
      },
      // No real provider credentials/network calls in this API contract fixture.
      { provide: ValidateDataMartDefinitionService, useValue: { run: validate } },
    ]);
    app = fixture.app;
    agent = fixture.agent;
  });

  afterAll(async () => {
    if (app) await closeTestApp(app);
    if (originalMcpOrigin === undefined) delete process.env.MCP_PUBLIC_BASE_URL;
    else process.env.MCP_PUBLIC_BASE_URL = originalMcpOrigin;
  });

  async function rpc(token: string, method: string, params: Record<string, unknown> = {}) {
    const req = agent
      .post('/mcp')
      .set('Authorization', `Bearer ${token}`)
      .set('Host', 'digitalreport.p2pdigital.io.vn')
      .set('X-Forwarded-Proto', 'https')
      .set('Accept', 'application/json, text/event-stream')
      .set('MCP-Protocol-Version', version)
      .set('Mcp-Method', method);
    if (typeof params.name === 'string') req.set('Mcp-Name', params.name);
    const response = await req.send({
      jsonrpc: '2.0',
      id: 1,
      method,
      params: {
        ...params,
        _meta: {
          'io.modelcontextprotocol/protocolVersion': version,
          'io.modelcontextprotocol/clientCapabilities': {},
          'io.modelcontextprotocol/clientInfo': { name: 'fixture-client', version: '1.0' },
        },
      },
    });
    expect(response.status).toBe(200);
    const body = response.headers['content-type']?.startsWith('text/event-stream')
      ? JSON.parse(
          response.text
            .split('\n')
            .find(line => line.startsWith('data: '))!
            .slice(6)
        )
      : response.body;
    expect(JSON.stringify(body)).not.toContain(canary);
    return body;
  }

  const call = (token: string, name: string, args: Record<string, unknown> = {}) =>
    rpc(token, 'tools/call', { name, arguments: args });
  function success(body: {
    result?: { isError?: boolean; structuredContent?: Record<string, unknown> };
    error?: unknown;
  }) {
    expect(body.error).toBeUndefined();
    expect(body.result?.isError).not.toBe(true);
    return body.result!.structuredContent!;
  }
  function denied(body: { result?: { isError?: boolean }; error?: unknown }) {
    expect(Boolean(body.error) || body.result?.isError === true).toBe(true);
  }

  it('lists all 30 registered tools with setup schemas', async () => {
    const body = await rpc('read-a', 'tools/list');
    const tools = body.result.tools as Array<{
      name: string;
      inputSchema: { properties: Record<string, unknown> };
    }>;
    expect(tools).toHaveLength(30);
    expect(tools.map(tool => tool.name)).toEqual(
      expect.arrayContaining([
        'list_data_storages',
        'list_connectors',
        'get_connector_specification',
        'get_connector_fields',
        'create_data_storage',
        'configure_data_storage',
        'validate_data_storage',
        'create_data_mart',
        'update_data_mart',
        'validate_data_mart',
        'publish_data_mart',
        'get_data_mart_setup_status',
      ])
    );
    expect(
      tools.find(tool => tool.name === 'create_data_mart')!.inputSchema.properties
    ).not.toHaveProperty('project_id');
  });

  it('rejects read-only scope, viewer mutation and model-supplied project override', async () => {
    const args = { storage_type: 'GOOGLE_BIGQUERY', title: 'Fixture warehouse' };
    denied(await call('read-a', 'create_data_storage', args));
    denied(await call('viewer-a', 'create_data_storage', args));
    denied(await call('write-a', 'create_data_storage', { ...args, project_id: 'project-b' }));
    expect(await app.get(DataSource).query('SELECT COUNT(*) AS count FROM data_storage')).toEqual([
      { count: 0 },
    ]);
  });

  it('creates warehouse titles atomically, lists only current-project warehouses and rejects legacy', async () => {
    storageA = String(
      success(
        await call('write-a', 'create_data_storage', {
          storage_type: 'GOOGLE_BIGQUERY',
          title: 'Fixture A',
        })
      ).storage_id
    );
    storageB = String(
      success(
        await call('write-b', 'create_data_storage', {
          storage_type: 'GOOGLE_BIGQUERY',
          title: 'Fixture B',
        })
      ).storage_id
    );
    const result = success(await call('read-a', 'list_data_storages'));
    expect(result.data_storages).toEqual([
      expect.objectContaining({
        storage_id: storageA,
        title: 'Fixture A',
        credential_status: 'missing',
        setup_required: true,
      }),
    ]);
    expect(JSON.stringify(result)).not.toContain(storageB);
    denied(
      await call('write-a', 'create_data_storage', {
        storage_type: 'LEGACY_GOOGLE_BIGQUERY',
        title: 'Legacy',
      })
    );
  });

  it('rejects plaintext storage secrets and foreign storage IDs; validation reports missing setup', async () => {
    denied(
      await call('write-a', 'configure_data_storage', {
        storage_id: storageA,
        title: 'A',
        config: { projectId: 'test', private_key: canary },
        source_storage_id: 'source-storage',
      })
    );
    denied(
      await call('write-a', 'configure_data_storage', {
        storage_id: storageB,
        title: 'Foreign',
        config: { projectId: 'test' },
        source_storage_id: storageA,
      })
    );
    const result = success(
      await call('write-a', 'validate_data_storage', { storage_id: storageA })
    );
    expect(result).toMatchObject({ valid: false, code: 'UNCONFIGURED' });
  });

  it('discovers connector metadata without secret defaults or OAuth parameters', async () => {
    const connectors = success(await call('read-a', 'list_connectors')).connectors as Array<{
      name: string;
    }>;
    expect(connectors.length).toBeGreaterThan(0);
    for (const connector of connectors) {
      const spec = success(
        await call('read-a', 'get_connector_specification', {
          connector_name: connector.name,
        })
      );
      expect(JSON.stringify(spec)).not.toContain('oauthParams');
      expect(spec.specification).toEqual(expect.any(Array));
      const fields = success(
        await call('read-a', 'get_connector_fields', {
          connector_name: connector.name,
        })
      );
      expect(fields.fields).toEqual(expect.any(Array));
    }
  });

  it('creates and updates a draft through existing persistence without publishing', async () => {
    const created = success(
      await call('write-a', 'create_data_mart', {
        title: 'Fixture draft',
        storage_id: storageA,
        definition_type: 'SQL',
        definition: { sqlQuery: 'SELECT 1 AS fixture' },
      })
    );
    dataMartA = String(created.data_mart_id);
    expect(created).toMatchObject({ status: 'DRAFT', definition_type: 'SQL' });
    expect(created).not.toHaveProperty('definition');
    const updated = success(
      await call('write-a', 'update_data_mart', {
        data_mart_id: dataMartA,
        title: 'Fixture renamed',
        description: 'Fixture description',
      })
    );
    expect(updated).toMatchObject({
      status: 'DRAFT',
      title: 'Fixture renamed',
      description: 'Fixture description',
    });
    const setup = success(
      await call('read-a', 'get_data_mart_setup_status', { data_mart_id: dataMartA })
    );
    expect(setup).toMatchObject({ status: 'DRAFT', storage_id: storageA });
  });

  it('rejects cross-project Data Mart access, viewer update, invalid definitions and plaintext connector secrets', async () => {
    denied(await call('write-b', 'get_data_mart_setup_status', { data_mart_id: dataMartA }));
    denied(
      await call('write-b', 'update_data_mart', { data_mart_id: dataMartA, title: 'Foreign' })
    );
    denied(
      await call('viewer-a', 'update_data_mart', { data_mart_id: dataMartA, title: 'Viewer' })
    );
    denied(
      await call('write-a', 'create_data_mart', {
        title: 'Invalid',
        storage_id: storageA,
        definition_type: 'SQL',
        definition: { pattern: 'invalid' },
      })
    );
    denied(
      await call('write-a', 'create_data_mart', {
        title: 'Secret invalid',
        storage_id: storageA,
        definition_type: 'CONNECTOR',
        definition: {
          connector: {
            source: {
              name: 'FacebookMarketing',
              node: 'campaigns',
              fields: ['id'],
              configuration: [{ AccessToken: canary }],
            },
            storage: { fullyQualifiedName: 'fixture.test.table' },
          },
        },
      })
    );
  });

  it('validates through the existing use-case and publishes only on a separate call', async () => {
    const result = success(
      await call('write-a', 'validate_data_mart', { data_mart_id: dataMartA })
    );
    expect(result.valid).toBe(true);
    expect(validate).toHaveBeenCalledWith(
      expect.objectContaining({ id: dataMartA, projectId: 'project-a' })
    );
    denied(await call('read-a', 'publish_data_mart', { data_mart_id: dataMartA }));
    const published = success(
      await call('write-a', 'publish_data_mart', { data_mart_id: dataMartA })
    );
    expect(published).toMatchObject({ status: 'PUBLISHED', connector_run_may_start: false });
    const empty = success(
      await call('write-a', 'create_data_mart', { title: 'Empty draft', storage_id: storageA })
    );
    denied(await call('write-a', 'publish_data_mart', { data_mart_id: empty.data_mart_id }));
  });
});
