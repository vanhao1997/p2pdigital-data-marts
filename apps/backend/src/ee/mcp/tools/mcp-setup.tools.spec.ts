import { z } from 'zod';
import { ForbiddenException } from '@nestjs/common';
import { DataStorageType } from '../../../data-marts/data-storage-types/enums/data-storage-type.enum';
import { DataMartDefinitionType } from '../../../data-marts/enums/data-mart-definition-type.enum';
import type { McpSetupStoragesFacade } from '../../../data-marts/facades/mcp-setup-storages.facade';
import type { McpSetupDataMartsFacade } from '../../../data-marts/facades/mcp-setup-data-marts.facade';
import type { McpAuthContext } from '../auth/mcp-auth-context';
import type { McpToolDefinition } from './mcp-tool.definition';
import {
  ListDataStoragesTool,
  ListConnectorsTool,
  GetConnectorSpecificationTool,
  GetConnectorFieldsTool,
  CreateDataStorageTool,
  ConfigureDataStorageTool,
  ValidateDataStorageTool,
} from './storage-setup.tools';
import {
  CreateDataMartTool,
  UpdateDataMartTool,
  ValidateDataMartTool,
  PublishDataMartTool,
  GetDataMartSetupStatusTool,
} from './data-mart-setup.tools';

const context: McpAuthContext = {
  projectId: 'project-1',
  userId: 'user-1',
  roles: ['editor'],
  clientId: 'client-1',
  resource: 'https://app.example.test/mcp',
  authFlow: 'mcp',
  scopes: ['mcp:read', 'mcp:write'],
};
const origin = { getPublicOrigin: () => 'https://app.example.test' } as never;
const storage = {
  storageId: 'storage-1',
  title: 'Warehouse',
  storageType: DataStorageType.GOOGLE_BIGQUERY,
  credentialStatus: 'configured',
  setupRequired: false,
  credentials: 'must-not-leak',
  config: { password: 'must-not-leak' },
};
const dataMart = {
  dataMartId: 'dm-1',
  title: 'Orders',
  status: 'DRAFT',
  definitionType: DataMartDefinitionType.SQL,
  storageId: 'storage-1',
  credentialStatus: 'configured',
  setupRequired: false,
  configurationUrl: '/unsafe-untrusted-url',
  definition: { sqlQuery: 'must-not-leak' },
  latestRun: {
    id: 'run-1',
    status: 'SUCCESS',
    type: 'manual',
    createdAt: '2026-10-08T00:00:00Z',
    logs: 'must-not-leak',
  },
};

describe('MCP setup tools', () => {
  const facade = {
    listDataStorages: jest.fn().mockResolvedValue({ dataStorages: [storage] }),
    listConnectors: jest.fn().mockResolvedValue({
      connectors: [
        { name: 'Source', title: 'Source', description: null, logo: null, docUrl: null },
      ],
    }),
    getConnectorSpecification: jest.fn().mockResolvedValue({
      connectorName: 'Source',
      specification: [{ name: 'Account', secret: false, oauth: false }],
    }),
    getConnectorFields: jest.fn().mockResolvedValue({
      connectorName: 'Source',
      fields: [{ name: 'node', fields: [{ name: 'field' }] }],
    }),
    createDataStorage: jest.fn().mockResolvedValue(storage),
    configureDataStorage: jest.fn().mockResolvedValue(storage),
    validateDataStorage: jest.fn().mockResolvedValue({ ...storage, valid: true }),
    createDataMart: jest.fn().mockResolvedValue(dataMart),
    updateDataMart: jest.fn().mockResolvedValue(dataMart),
    validateDataMart: jest.fn().mockResolvedValue({ dataMart, valid: true }),
    publishDataMart: jest
      .fn()
      .mockResolvedValue({ ...dataMart, status: 'PUBLISHED', connectorRunMayStart: true }),
    getDataMartSetupStatus: jest.fn().mockResolvedValue(dataMart),
  };
  const storageFacade = facade as unknown as McpSetupStoragesFacade;
  const dataMartFacade = facade as unknown as McpSetupDataMartsFacade;
  const cases: Array<{
    tool: McpToolDefinition;
    method: keyof typeof facade;
    input: Record<string, unknown>;
    scope: string;
  }> = [
    {
      tool: new ListDataStoragesTool(storageFacade, origin),
      method: 'listDataStorages',
      input: {},
      scope: 'mcp:read',
    },
    {
      tool: new ListConnectorsTool(storageFacade),
      method: 'listConnectors',
      input: {},
      scope: 'mcp:read',
    },
    {
      tool: new GetConnectorSpecificationTool(storageFacade),
      method: 'getConnectorSpecification',
      input: { connector_name: 'Source' },
      scope: 'mcp:read',
    },
    {
      tool: new GetConnectorFieldsTool(storageFacade),
      method: 'getConnectorFields',
      input: { connector_name: 'Source' },
      scope: 'mcp:read',
    },
    {
      tool: new CreateDataStorageTool(storageFacade, origin),
      method: 'createDataStorage',
      input: { storage_type: 'GOOGLE_BIGQUERY', title: 'Warehouse' },
      scope: 'mcp:write',
    },
    {
      tool: new ConfigureDataStorageTool(storageFacade, origin),
      method: 'configureDataStorage',
      input: {
        storage_id: 'storage-1',
        title: 'Warehouse',
        config: { projectId: 'warehouse' },
        source_storage_id: 'source-1',
      },
      scope: 'mcp:write',
    },
    {
      tool: new ValidateDataStorageTool(storageFacade, origin),
      method: 'validateDataStorage',
      input: { storage_id: 'storage-1' },
      scope: 'mcp:write',
    },
    {
      tool: new CreateDataMartTool(dataMartFacade, origin),
      method: 'createDataMart',
      input: {
        storage_id: 'storage-1',
        title: 'Orders',
        definition_type: 'SQL',
        definition: { sqlQuery: 'SELECT 1' },
      },
      scope: 'mcp:write',
    },
    {
      tool: new UpdateDataMartTool(dataMartFacade, origin),
      method: 'updateDataMart',
      input: { data_mart_id: 'dm-1', title: 'Orders' },
      scope: 'mcp:write',
    },
    {
      tool: new ValidateDataMartTool(dataMartFacade, origin),
      method: 'validateDataMart',
      input: { data_mart_id: 'dm-1' },
      scope: 'mcp:write',
    },
    {
      tool: new PublishDataMartTool(dataMartFacade, origin),
      method: 'publishDataMart',
      input: { data_mart_id: 'dm-1' },
      scope: 'mcp:write',
    },
    {
      tool: new GetDataMartSetupStatusTool(dataMartFacade, origin),
      method: 'getDataMartSetupStatus',
      input: { data_mart_id: 'dm-1' },
      scope: 'mcp:read',
    },
  ];

  beforeEach(() => jest.clearAllMocks());

  it.each(cases)(
    '$tool.name passes trusted context and returns a schema-valid safe result',
    async ({ tool, method, input, scope }) => {
      const result = await tool.handler(input, context);
      expect(tool.requiredScopes).toEqual([scope]);
      expect(facade[method]).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: 'project-1', userId: 'user-1', roles: ['editor'] })
      );
      expect(() =>
        z.object(tool.outputSchema!).strict().parse(result.structuredContent)
      ).not.toThrow();
      expect(JSON.stringify(result)).not.toContain('must-not-leak');
      expect(JSON.stringify(result)).not.toContain('unsafe-untrusted-url');
    }
  );

  it.each(cases)(
    '$tool.name refuses caller-supplied project IDs and credential payloads before the facade',
    async ({ tool, method, input }) => {
      await expect(tool.handler({ ...input, project_id: 'foreign' }, context)).rejects.toThrow();
      await expect(
        tool.handler({ ...input, credentials: { password: 'plaintext' } }, context)
      ).rejects.toThrow();
      expect(facade[method]).not.toHaveBeenCalled();
    }
  );

  it('refuses conflicting storage credential sources', async () => {
    const tool = new ConfigureDataStorageTool(storageFacade, origin);
    await expect(
      tool.handler(
        {
          storage_id: 'storage-1',
          title: 'A',
          config: {},
          credential_id: 'cred',
          source_storage_id: 'source',
        },
        context
      )
    ).rejects.toThrow();
    expect(facade.configureDataStorage).not.toHaveBeenCalled();
  });

  it('requires one storage credential source before the facade', async () => {
    const tool = new ConfigureDataStorageTool(storageFacade, origin);
    await expect(
      tool.handler(
        {
          storage_id: 'storage-1',
          title: 'A',
          config: {},
        },
        context
      )
    ).rejects.toThrow();
    expect(facade.configureDataStorage).not.toHaveBeenCalled();
  });

  it('maps paired connector-copy fields without accepting raw source pointers', async () => {
    const tool = new UpdateDataMartTool(dataMartFacade, origin);
    await tool.handler(
      {
        data_mart_id: 'dm-1',
        title: 'Copy',
        source_data_mart_id: 'source-dm',
        source_configuration_id: 'source-config',
      },
      context
    );
    expect(facade.updateDataMart).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceDataMartId: 'source-dm',
        sourceConfigurationId: 'source-config',
      })
    );
    await expect(
      tool.handler({ data_mart_id: 'dm-1', _secrets_id: 'raw-secret' }, context)
    ).rejects.toThrow();
  });

  it('preserves safe permission failures from the facade', async () => {
    facade.createDataStorage.mockRejectedValueOnce(new ForbiddenException('Permission denied'));
    await expect(
      new CreateDataStorageTool(storageFacade, origin).handler(
        { storage_type: 'GOOGLE_BIGQUERY', title: 'A' },
        context
      )
    ).rejects.toThrow('Permission denied');
  });

  it('documents explicit publish authorization and the automatic incremental run', () => {
    const tool = new PublishDataMartTool(dataMartFacade, origin);
    expect(tool.description).toContain('ONLY when the user explicitly requests');
    expect(tool.description).toContain('incremental run');
    expect(tool.description).toContain('consumption');
  });

  it('omits a nullable database description while exposing only safe connector configuration IDs', async () => {
    facade.getDataMartSetupStatus.mockResolvedValueOnce({
      ...dataMart,
      description: null,
      connector: {
        name: 'Source',
        configurationIds: ['configuration-1'],
        credentials: 'must-not-leak',
      },
    });
    const result = await new GetDataMartSetupStatusTool(dataMartFacade, origin).handler(
      { data_mart_id: 'dm-1' },
      context
    );
    expect(result.structuredContent).not.toHaveProperty('description');
    expect(result.structuredContent).toHaveProperty('connector', {
      name: 'Source',
      configuration_ids: ['configuration-1'],
    });
    expect(JSON.stringify(result)).not.toContain('must-not-leak');
  });
});
