import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DataStorageType } from '../data-storage-types/enums/data-storage-type.enum';
import { ValidationResult } from '../data-storage-types/interfaces/data-mart-validator.interface';
import { DataMartDto } from '../dto/domain/data-mart.dto';
import { DataStorageDto } from '../dto/domain/data-storage.dto';
import { DataMartDefinitionType } from '../enums/data-mart-definition-type.enum';
import { DataMartStatus } from '../enums/data-mart-status.enum';
import { StorageCredentialType } from '../enums/storage-credential-type.enum';
import { McpSetupDataMartsMapper } from '../mappers/mcp-setup-data-marts.mapper';
import { McpSetupDataMartsFacadeImpl } from './mcp-setup-data-marts.facade.impl';

const actor = { projectId: 'project-a', userId: 'user-a', roles: ['editor'] };
const request = { ...actor, dataMartId: 'mart-a' };
const storage = new DataStorageDto(
  'storage-a',
  'Warehouse',
  DataStorageType.GOOGLE_BIGQUERY,
  'project-a',
  { projectId: 'warehouse-a' },
  new Date(),
  new Date(),
  0,
  0,
  'storage-credential'
);
function draft(overrides: Partial<DataMartDto> = {}): DataMartDto {
  return Object.assign(
    new DataMartDto(
      'mart-a',
      'Sales',
      DataMartStatus.DRAFT,
      storage,
      new Date(),
      new Date(),
      DataMartDefinitionType.SQL,
      { sqlQuery: 'SELECT 1' }
    ),
    overrides
  );
}
function connectorDefinition(config: Record<string, unknown> = {}) {
  return {
    connector: {
      source: { name: 'GoogleAds', configuration: [config], node: 'campaign', fields: ['id'] },
      storage: { fullyQualifiedName: 'warehouse.dataset.sales' },
    },
  };
}

describe('McpSetupDataMartsFacadeImpl', () => {
  let facade: McpSetupDataMartsFacadeImpl;
  const create = { run: jest.fn() };
  const updateDefinition = { run: jest.fn() };
  const updateTitle = { run: jest.fn() };
  const updateDescription = { run: jest.fn() };
  const validate = { run: jest.fn() };
  const publish = { run: jest.fn() };
  const get = { run: jest.fn() };
  const runs = { run: jest.fn() };
  const storages = { getByProjectIdAndId: jest.fn() };
  const warehouseCredentials = { getById: jest.fn() };
  const connectors = { getConnectorSpecification: jest.fn() };
  const secrets = { mask: jest.fn() };
  const credentials = { getCredentialsById: jest.fn() };
  const access = { canAccess: jest.fn() };

  beforeEach(() => {
    jest.resetAllMocks();
    create.run.mockResolvedValue(draft({ definitionType: undefined, definition: undefined }));
    updateDefinition.run.mockResolvedValue(draft());
    updateTitle.run.mockResolvedValue(draft({ title: 'Updated' }));
    updateDescription.run.mockResolvedValue(draft({ description: 'Description' }));
    validate.run.mockResolvedValue(ValidationResult.success());
    publish.run.mockResolvedValue(draft({ status: DataMartStatus.PUBLISHED }));
    get.run.mockResolvedValue(draft());
    runs.run.mockResolvedValue([]);
    storages.getByProjectIdAndId.mockResolvedValue(storage);
    warehouseCredentials.getById.mockResolvedValue({
      projectId: 'project-a',
      type: StorageCredentialType.GOOGLE_SERVICE_ACCOUNT,
      credentials: {},
      expiresAt: null,
    });
    connectors.getConnectorSpecification.mockResolvedValue([
      {
        name: 'AuthType',
        oneOf: [
          {
            label: 'Token',
            value: 'token',
            items: {
              ApiKey: { name: 'ApiKey', attributes: ['SECRET'] },
            },
          },
        ],
      },
    ]);
    secrets.mask.mockImplementation(value => Promise.resolve(value));
    access.canAccess.mockResolvedValue(true);
    facade = new McpSetupDataMartsFacadeImpl(
      create as never,
      updateDefinition as never,
      updateTitle as never,
      updateDescription as never,
      validate as never,
      publish as never,
      get as never,
      runs as never,
      storages as never,
      warehouseCredentials as never,
      connectors as never,
      secrets as never,
      credentials as never,
      access as never,
      new McpSetupDataMartsMapper()
    );
  });

  it.each(['createDataMart', 'updateDataMart', 'validateDataMart', 'publishDataMart'] as const)(
    'requires editor/admin for %s',
    async method => {
      await expect(
        facade[method]({
          ...request,
          roles: ['viewer'],
          title: 'Draft',
          storageId: 'storage-a',
        } as never)
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(create.run).not.toHaveBeenCalled();
      expect(get.run).not.toHaveBeenCalled();
    }
  );

  it('does not allow an empty user ID to bypass use-case authorization', async () => {
    await expect(
      facade.createDataMart({ ...actor, userId: '', title: 'Draft', storageId: 'storage-a' })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(create.run).not.toHaveBeenCalled();
  });

  it('checks storage USE permission before reading storage metadata or creating a draft', async () => {
    access.canAccess.mockResolvedValue(false);
    await expect(
      facade.createDataMart({ ...actor, title: 'Draft', storageId: 'storage-a' })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(storages.getByProjectIdAndId).not.toHaveBeenCalled();
    expect(create.run).not.toHaveBeenCalled();
  });

  it('creates only a draft through the existing service and forwards the trusted actor', async () => {
    const result = await facade.createDataMart({
      ...actor,
      title: 'Draft',
      storageId: 'storage-a',
    });
    expect(create.run).toHaveBeenCalledWith(
      expect.objectContaining({ ...actor, title: 'Draft', storageId: 'storage-a' })
    );
    expect(result).toMatchObject({ dataMartId: 'mart-a', status: 'DRAFT', setupRequired: true });
    expect(publish.run).not.toHaveBeenCalled();
  });

  it('uses existing legacy storage through the existing draft creation use-case', async () => {
    storages.getByProjectIdAndId.mockResolvedValue({
      ...storage,
      type: DataStorageType.LEGACY_GOOGLE_BIGQUERY,
    });
    const result = await facade.createDataMart({
      ...actor,
      title: 'Draft',
      storageId: 'storage-a',
    });
    expect(result.status).toBe(DataMartStatus.DRAFT);
    expect(create.run).toHaveBeenCalled();
  });

  it.each([
    { definitionType: DataMartDefinitionType.SQL },
    { definition: { sqlQuery: 'SELECT 1' } },
    { definitionType: DataMartDefinitionType.TABLE, definition: { sqlQuery: 'SELECT 1' } },
    {
      definitionType: DataMartDefinitionType.SQL,
      definition: { sqlQuery: 'SELECT 1', token: 'unsafe' },
    },
    { definitionType: DataMartDefinitionType.CONNECTOR, definition: { connector: {} } },
  ])('rejects malformed/type mismatched definitions before creating: %j', async input => {
    await expect(
      facade.createDataMart({ ...actor, title: 'Draft', storageId: 'storage-a', ...input })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(create.run).not.toHaveBeenCalled();
  });

  it.each([
    [DataMartDefinitionType.SQL, { sqlQuery: 'SELECT 1' }],
    [DataMartDefinitionType.TABLE, { fullyQualifiedName: 'dataset.table' }],
    [DataMartDefinitionType.VIEW, { fullyQualifiedName: 'dataset.view' }],
    [DataMartDefinitionType.TABLE_PATTERN, { pattern: 'dataset.table_*' }],
    [DataMartDefinitionType.CONNECTOR, connectorDefinition()],
  ] as const)(
    'delegates valid %s definitions to the existing update pipeline',
    async (definitionType, definition) => {
      await facade.createDataMart({
        ...actor,
        title: 'Draft',
        storageId: 'storage-a',
        definitionType,
        definition,
      });
      expect(updateDefinition.run).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'mart-a',
          projectId: 'project-a',
          userId: 'user-a',
          roles: ['editor'],
          definitionType,
          definition,
        })
      );
    }
  );

  it.each([
    { AuthType: { token: { ApiKey: 'private-test-secret' } } },
    { nested: [{ ApiKey: 'private-test-secret' }] },
    { _secrets_id: 'other-mart-secret' },
    { AuthType: { oauth: { _source_credential_id: 'other-project' } } },
    { _copiedFrom: { configId: 'unapproved' } },
    { _generated_refresh_token: 'raw-token' },
    { arbitrary: { access_token: 'private-test-secret' } },
    { credentials: { login: 'private-test-secret' } },
    { arbitrary: { PrivateKey: 'private-test-secret' } },
    { arbitrary: { Authorization: 'private-test-secret' } },
  ])('rejects plaintext secrets and unchecked raw pointers: %j', async config => {
    await expect(
      facade.createDataMart({
        ...actor,
        title: 'Draft',
        storageId: 'storage-a',
        definitionType: DataMartDefinitionType.CONNECTOR,
        definition: connectorDefinition(config),
      })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(create.run).not.toHaveBeenCalled();
  });

  it('accepts opaque saved-variable markers for the existing resolver', async () => {
    const definition = connectorDefinition({ _credential_variable_id: 'variable-a' });
    await facade.createDataMart({
      ...actor,
      title: 'Draft',
      storageId: 'storage-a',
      definitionType: DataMartDefinitionType.CONNECTOR,
      definition,
    });
    expect(updateDefinition.run).toHaveBeenCalledWith(expect.objectContaining({ definition }));
  });

  it('accepts masked secret-bearing parent options', async () => {
    const definition = connectorDefinition({ AuthType: { token: { ApiKey: '**********' } } });
    await facade.createDataMart({
      ...actor,
      title: 'Draft',
      storageId: 'storage-a',
      definitionType: DataMartDefinitionType.CONNECTOR,
      definition,
    });
    expect(updateDefinition.run).toHaveBeenCalledWith(expect.objectContaining({ definition }));
  });

  it('rejects unmarked plaintext descendants inherited from OAUTH_FLOW specification', async () => {
    connectors.getConnectorSpecification.mockResolvedValue([
      {
        name: 'AuthType',
        oneOf: [
          { attributes: ['OAUTH_FLOW'], items: { providerPayload: { name: 'providerPayload' } } },
        ],
      },
    ]);
    await expect(
      facade.createDataMart({
        ...actor,
        title: 'Draft',
        storageId: 'storage-a',
        definitionType: DataMartDefinitionType.CONNECTOR,
        definition: connectorDefinition({ providerPayload: 'private-test-secret' }),
      })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(create.run).not.toHaveBeenCalled();
  });

  it('preserves owned OAuth pointers on an existing configuration without accepting raw model pointers', async () => {
    get.run.mockResolvedValue(
      draft({
        definitionType: DataMartDefinitionType.CONNECTOR,
        definition: connectorDefinition({
          _id: 'config-a',
          AuthType: { oauth: { _source_credential_id: 'credential-a' } },
        }),
      })
    );
    credentials.getCredentialsById.mockResolvedValue({
      projectId: 'project-a',
      connectorName: 'GoogleAds',
    });
    await facade.updateDataMart({
      ...request,
      definitionType: DataMartDefinitionType.CONNECTOR,
      definition: connectorDefinition({ _id: 'config-a', AuthType: { oauth: {} } }),
    });
    expect(updateDefinition.run).toHaveBeenCalledWith(
      expect.objectContaining({
        definition: {
          connector: expect.objectContaining({
            source: expect.objectContaining({
              configuration: [
                expect.objectContaining({
                  AuthType: { oauth: { _source_credential_id: 'credential-a' } },
                }),
              ],
            }),
          }),
        },
      })
    );
  });

  it('retains the new draft ID when a subsequent use-case fails and hides driver errors', async () => {
    updateDefinition.run.mockRejectedValue(new Error('private-test-secret in provider error'));
    get.run.mockResolvedValue(draft({ definitionType: undefined, definition: undefined }));
    const result = await facade.createDataMart({
      ...actor,
      title: 'Draft',
      storageId: 'storage-a',
      definitionType: DataMartDefinitionType.SQL,
      definition: { sqlQuery: 'SELECT 1' },
    });
    expect(result).toMatchObject({
      dataMartId: 'mart-a',
      status: 'DRAFT',
      setupError: { code: 'DATA_MART_SETUP_INCOMPLETE' },
    });
    expect(JSON.stringify(result)).not.toContain('private-test-secret');
    expect(create.run).toHaveBeenCalledTimes(1);
  });

  it('passes tenant/user context to status and limits run lookup to the accessible mart', async () => {
    const date = new Date('2026-10-08T00:00:00Z');
    runs.run.mockResolvedValue([
      {
        id: 'run-a',
        status: 'FAILED',
        type: 'CONNECTOR',
        createdAt: date,
        logs: ['private-test-secret'],
        definitionRun: { private: 'private-test-secret' },
      },
    ]);
    const result = await facade.getDataMartSetupStatus(request);
    expect(get.run).toHaveBeenCalledWith(expect.objectContaining({ id: 'mart-a', ...actor }));
    expect(runs.run).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'mart-a', ...actor, limit: 1, offset: 0 })
    );
    expect(result.latestRun).toEqual({
      id: 'run-a',
      status: 'FAILED',
      type: 'CONNECTOR',
      createdAt: date.toISOString(),
    });
    expect(JSON.stringify(result)).not.toContain('private-test-secret');
  });

  it('rejects cross-project status without fetching runs', async () => {
    get.run.mockRejectedValue(new NotFoundException('private project detail'));
    await expect(facade.getDataMartSetupStatus(request)).rejects.toBeInstanceOf(NotFoundException);
    expect(runs.run).not.toHaveBeenCalled();
  });

  it('checks edit access before changing an existing mart', async () => {
    access.canAccess.mockResolvedValue(false);
    await expect(facade.updateDataMart({ ...request, title: 'Changed' })).rejects.toBeInstanceOf(
      ForbiddenException
    );
    expect(updateTitle.run).not.toHaveBeenCalled();
  });

  it('returns existing mart ID with setupRequired when an update fails before a write', async () => {
    updateTitle.run.mockRejectedValue(new Error('private-test-secret from driver'));
    const result = await facade.updateDataMart({ ...request, title: 'Changed' });
    expect(result).toMatchObject({
      dataMartId: 'mart-a',
      title: 'Sales',
      setupRequired: true,
      setupError: { code: 'DATA_MART_SETUP_INCOMPLETE' },
    });
    expect(JSON.stringify(result)).not.toContain('private-test-secret');
    expect(result.setupError?.message).toContain('exists');
  });

  it('preserves provider failure HTTP severity without exposing its payload', async () => {
    storages.getByProjectIdAndId.mockRejectedValue(new Error('private-test-secret from driver'));
    try {
      await facade.createDataMart({ ...actor, title: 'Draft', storageId: 'storage-a' });
      throw new Error('Expected setup failure');
    } catch (error) {
      expect(error.getStatus()).toBe(500);
      expect(error.message).not.toContain('private-test-secret');
    }
    expect(create.run).not.toHaveBeenCalled();
  });

  it('denies credential copying without source edit permission', async () => {
    access.canAccess.mockResolvedValue(false);
    await expect(
      facade.createDataMart({
        ...actor,
        title: 'Draft',
        storageId: 'storage-a',
        definitionType: DataMartDefinitionType.CONNECTOR,
        definition: connectorDefinition(),
        sourceDataMartId: 'source-a',
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(create.run).not.toHaveBeenCalled();
  });

  it('checks source credential tenant before attaching internal pointers', async () => {
    get.run.mockResolvedValue(
      draft({
        id: 'source-a',
        definitionType: DataMartDefinitionType.CONNECTOR,
        definition: connectorDefinition({
          _id: 'source-config',
          AuthType: { oauth: { _source_credential_id: 'credential-a' } },
        }),
      })
    );
    credentials.getCredentialsById.mockResolvedValue({
      projectId: 'project-b',
      connectorName: 'GoogleAds',
    });
    await expect(
      facade.createDataMart({
        ...actor,
        title: 'Draft',
        storageId: 'storage-a',
        definitionType: DataMartDefinitionType.CONNECTOR,
        definition: connectorDefinition(),
        sourceDataMartId: 'source-a',
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(create.run).not.toHaveBeenCalled();
  });

  it('copies only server-owned credential pointers after source access checks', async () => {
    get.run.mockResolvedValue(
      draft({
        id: 'source-a',
        definitionType: DataMartDefinitionType.CONNECTOR,
        definition: connectorDefinition({
          _id: 'source-config',
          AuthType: { oauth: { _source_credential_id: 'credential-a' } },
        }),
      })
    );
    credentials.getCredentialsById.mockResolvedValue({
      projectId: 'project-a',
      connectorName: 'GoogleAds',
    });
    await facade.createDataMart({
      ...actor,
      title: 'Draft',
      storageId: 'storage-a',
      definitionType: DataMartDefinitionType.CONNECTOR,
      definition: connectorDefinition(),
      sourceDataMartId: 'source-a',
      sourceConfigurationId: 'source-config',
    });
    expect(updateDefinition.run).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceDataMartId: 'source-a',
        sourceConfigurationId: 'source-config',
        definition: {
          connector: expect.objectContaining({
            source: expect.objectContaining({
              configuration: [
                expect.objectContaining({
                  AuthType: { oauth: { _source_credential_id: 'credential-a' } },
                  _copiedFrom: { configId: 'source-config' },
                }),
              ],
            }),
          }),
        },
      })
    );
  });

  it('sanitizes provider validation messages, details, and reasons', async () => {
    validate.run.mockResolvedValue(
      ValidationResult.failure(
        'private-test-secret',
        { token: 'private-test-secret' },
        { secret: 'private-test-secret' }
      )
    );
    const result = await facade.validateDataMart(request);
    expect(result).toMatchObject({ valid: false, error: { code: 'DATA_MART_VALIDATION_FAILED' } });
    expect(JSON.stringify(result)).not.toContain('private-test-secret');
  });

  it('does not publish a mart without a definition', async () => {
    get.run.mockResolvedValue(draft({ definitionType: undefined, definition: undefined }));
    await expect(facade.publishDataMart(request)).rejects.toThrow('Data Mart has no definition');
    expect(publish.run).not.toHaveBeenCalled();
  });

  it('validates SQL before publish and blocks an invalid query', async () => {
    validate.run.mockResolvedValue(ValidationResult.failure('warehouse details'));
    await expect(facade.publishDataMart(request)).rejects.toBeInstanceOf(BadRequestException);
    expect(validate.run).toHaveBeenCalled();
    expect(publish.run).not.toHaveBeenCalled();
  });

  it('publishes through the existing service and preserves connector-run warning', async () => {
    const mart = draft({
      definitionType: DataMartDefinitionType.CONNECTOR,
      definition: connectorDefinition({ _id: 'config-a', _secrets_id: 'credential-a' }),
    });
    get.run.mockResolvedValue(mart);
    publish.run.mockResolvedValue({ ...mart, status: DataMartStatus.PUBLISHED });
    credentials.getCredentialsById.mockResolvedValue({
      projectId: 'project-a',
      connectorName: 'GoogleAds',
      dataMartId: 'mart-a',
      expiresAt: null,
    });
    const result = await facade.publishDataMart(request);
    expect(publish.run).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'mart-a', ...actor, createdById: 'user-a' })
    );
    expect(result).toMatchObject({ status: 'PUBLISHED', connectorRunMayStart: true });
    expect(result).not.toHaveProperty('definition');
    expect(result).not.toHaveProperty('syncCompleted');
  });

  it.each([
    ['project-b', null, 'missing'],
    ['project-a', new Date('2000-01-01'), 'expired'],
    ['project-a', null, 'configured'],
  ] as const)(
    'maps credential tenant/expiry safely: %s -> %s -> %s',
    async (projectId, expiresAt, status) => {
      get.run.mockResolvedValue(
        draft({
          definitionType: DataMartDefinitionType.CONNECTOR,
          definition: connectorDefinition({
            _id: 'config-a',
            _source_credential_id: 'credential-a',
          }),
        })
      );
      credentials.getCredentialsById.mockResolvedValue({
        projectId,
        connectorName: 'GoogleAds',
        expiresAt,
        credentials: { secret: 'private-test-secret' },
      });
      const result = await facade.getDataMartSetupStatus(request);
      expect(result.credentialStatus).toBe(status);
      expect(JSON.stringify(result)).not.toContain('private-test-secret');
      expect(result).not.toHaveProperty('definition');
    }
  );

  it.each([
    [null, 'missing'],
    [
      {
        projectId: 'project-b',
        type: StorageCredentialType.GOOGLE_SERVICE_ACCOUNT,
        credentials: {},
      },
      'missing',
    ],
    [{ projectId: 'project-a', type: StorageCredentialType.AWS_IAM, credentials: {} }, 'missing'],
    [
      {
        projectId: 'project-a',
        type: StorageCredentialType.GOOGLE_SERVICE_ACCOUNT,
        credentials: {},
        expiresAt: new Date('2000-01-01'),
      },
      'expired',
    ],
    [
      {
        projectId: 'project-a',
        type: StorageCredentialType.GOOGLE_OAUTH,
        credentials: { access_token: 'private-test-secret' },
      },
      'expired',
    ],
    [
      {
        projectId: 'project-a',
        type: StorageCredentialType.GOOGLE_OAUTH,
        credentials: { refresh_token: 'private-test-secret' },
        expiresAt: new Date('2000-01-01'),
      },
      'configured',
    ],
  ] as const)(
    'checks storage credential tenant/type and refreshable expiry: %j -> %s',
    async (credential, status) => {
      warehouseCredentials.getById.mockResolvedValue(credential);
      const result = await facade.getDataMartSetupStatus(request);
      expect(result.credentialStatus).toBe(status);
      expect(result.setupRequired).toBe(status !== 'configured');
      expect(JSON.stringify(result)).not.toContain('private-test-secret');
    }
  );

  it('maps unavailable storage credentials to unknown without losing the saved draft', async () => {
    warehouseCredentials.getById.mockRejectedValue(new Error('private-test-secret'));
    const result = await facade.createDataMart({
      ...actor,
      title: 'Draft',
      storageId: 'storage-a',
    });
    expect(result).toMatchObject({
      dataMartId: 'mart-a',
      credentialStatus: 'unknown',
      setupRequired: true,
    });
    expect(JSON.stringify(result)).not.toContain('private-test-secret');
  });

  it('blocks connector auto-run on missing or expired warehouse credentials', async () => {
    get.run.mockResolvedValue(
      draft({
        definitionType: DataMartDefinitionType.CONNECTOR,
        definition: connectorDefinition({ _id: 'config-a', _source_credential_id: 'credential-a' }),
      })
    );
    credentials.getCredentialsById.mockResolvedValue({
      projectId: 'project-a',
      connectorName: 'GoogleAds',
    });
    warehouseCredentials.getById.mockResolvedValue(null);
    await expect(facade.publishDataMart(request)).rejects.toBeInstanceOf(BadRequestException);
    expect(publish.run).not.toHaveBeenCalled();
    expect(validate.run).not.toHaveBeenCalled();
  });

  it('does not treat a foreign Data Mart manual secret as configured', async () => {
    get.run.mockResolvedValue(
      draft({
        definitionType: DataMartDefinitionType.CONNECTOR,
        definition: connectorDefinition({ _id: 'config-a', _secrets_id: 'credential-a' }),
      })
    );
    credentials.getCredentialsById.mockResolvedValue({
      projectId: 'project-a',
      connectorName: 'GoogleAds',
      dataMartId: 'mart-b',
    });
    const result = await facade.getDataMartSetupStatus(request);
    expect(result.credentialStatus).toBe('missing');
    expect(result.setupRequired).toBe(true);
  });
});
