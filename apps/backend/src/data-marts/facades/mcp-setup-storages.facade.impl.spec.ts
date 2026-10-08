jest.mock('typeorm-transactional', () => ({ Transactional: () => () => undefined }));
jest.mock('../services/user-projections-fetcher.service', () => ({
  UserProjectionsFetcherService: jest.fn(),
}));
jest.mock('../../idp/facades/idp-projections.facade', () => ({ IdpProjectionsFacade: jest.fn() }));
jest.mock('../use-cases/list-data-storages.service', () => ({
  ListDataStoragesService: jest.fn(),
}));
jest.mock('../use-cases/get-data-storage.service', () => ({ GetDataStorageService: jest.fn() }));
jest.mock('../use-cases/create-data-storage.service', () => ({
  CreateDataStorageService: jest.fn(),
}));
jest.mock('../use-cases/update-data-storage.service', () => ({
  UpdateDataStorageService: jest.fn(),
}));
jest.mock('../use-cases/validate-data-storage-access.service', () => ({
  ValidateDataStorageAccessService: jest.fn(),
}));
jest.mock('../use-cases/connector/available-connector.service', () => ({
  AvailableConnectorService: jest.fn(),
}));
jest.mock('../use-cases/connector/specification-connector.service', () => ({
  SpecificationConnectorService: jest.fn(),
}));
jest.mock('../use-cases/connector/fields-connector.service', () => ({
  FieldsConnectorService: jest.fn(),
}));
jest.mock('../services/data-storage-credential.service', () => ({
  DataStorageCredentialService: jest.fn(),
}));
jest.mock('../services/access-decision/access-decision.service', () => ({
  AccessDecisionService: jest.fn(),
}));

import { ForbiddenException, HttpException, NotFoundException } from '@nestjs/common';
import { DataStorageType } from '../data-storage-types/enums/data-storage-type.enum';
import { ValidationResult } from '../data-storage-types/interfaces/data-storage-access-validator.interface';
import { DataStorageDto } from '../dto/domain/data-storage.dto';
import { StorageCredentialType } from '../enums/storage-credential-type.enum';
import { McpSetupStoragesMapper } from '../mappers/mcp-setup-storages.mapper';
import { Action, EntityType } from '../services/access-decision';
import { McpSetupStoragesFacadeImpl } from './mcp-setup-storages.facade.impl';

describe('McpSetupStoragesFacadeImpl', () => {
  const context = { projectId: 'project-1', userId: 'user-1', roles: ['editor'] };
  const config = { projectId: 'warehouse-project', location: 'US' };
  const storage = (id = 'target', credentialId: string | null = 'credential-1') =>
    new DataStorageDto(
      id,
      'Warehouse',
      DataStorageType.GOOGLE_BIGQUERY,
      context.projectId,
      config,
      new Date(),
      new Date(),
      0,
      0,
      credentialId
    );
  const credential = (overrides: Record<string, unknown> = {}) => ({
    id: 'credential-1',
    projectId: context.projectId,
    type: StorageCredentialType.GOOGLE_SERVICE_ACCOUNT,
    credentials: { private_key: 'never-return-this' },
    ...overrides,
  });

  const setup = () => {
    const list = { run: jest.fn().mockResolvedValue([storage()]) };
    const get = {
      run: jest.fn().mockImplementation(command => Promise.resolve(storage(command.id))),
    };
    const create = { run: jest.fn().mockResolvedValue(storage('new', null)) };
    const update = { run: jest.fn().mockResolvedValue(storage()) };
    const validate = { run: jest.fn().mockResolvedValue(ValidationResult.success()) };
    const available = {
      run: jest
        .fn()
        .mockResolvedValue([
          { name: 'GoogleAds', title: 'Google Ads', description: null, logo: null, docUrl: null },
        ]),
    };
    const specification = {
      run: jest
        .fn()
        .mockResolvedValue([
          { name: 'Secret', attributes: ['SECRET'], default: 'never-return-this' },
        ]),
    };
    const fields = {
      run: jest.fn().mockResolvedValue([{ name: 'campaigns', fields: [{ name: 'id' }] }]),
    };
    const credentials = { getById: jest.fn().mockResolvedValue(credential()) };
    const access = { canAccess: jest.fn().mockResolvedValue(true) };
    const facade = new McpSetupStoragesFacadeImpl(
      list as never,
      get as never,
      create as never,
      update as never,
      validate as never,
      available as never,
      specification as never,
      fields as never,
      credentials as never,
      access as never,
      new McpSetupStoragesMapper()
    );
    return {
      facade,
      list,
      get,
      create,
      update,
      validate,
      available,
      specification,
      fields,
      credentials,
      access,
    };
  };

  it('lists only project-visible storages and projects secret-free status', async () => {
    const { facade, list } = setup();
    expect(await facade.listDataStorages(context)).toEqual({
      dataStorages: [
        {
          storageId: 'target',
          title: 'Warehouse',
          storageType: DataStorageType.GOOGLE_BIGQUERY,
          credentialId: 'credential-1',
          credentialStatus: 'configured',
          setupRequired: false,
        },
      ],
    });
    expect(list.run).toHaveBeenCalledWith(expect.objectContaining(context));
  });

  it('keeps configured status separate from actual validation and requires real credential metadata', async () => {
    const { facade, credentials, validate } = setup();
    credentials.getById.mockResolvedValue(null);
    const result = await facade.listDataStorages(context);
    expect(result.dataStorages[0]).toMatchObject({
      credentialStatus: 'unknown',
      setupRequired: true,
    });
    expect(validate.run).not.toHaveBeenCalled();
  });

  it('keeps refreshable OAuth connections configured despite access-token expiry', async () => {
    const { facade, credentials } = setup();
    credentials.getById.mockResolvedValue(
      credential({
        type: StorageCredentialType.GOOGLE_OAUTH,
        expiresAt: new Date(0),
        credentials: { refresh_token: 'refresh-secret' },
      })
    );
    expect((await facade.listDataStorages(context)).dataStorages[0].credentialStatus).toBe(
      'configured'
    );
  });

  it('returns safe connector metadata through dedicated projection', async () => {
    const { facade } = setup();
    expect((await facade.listConnectors(context)).connectors[0].name).toBe('GoogleAds');
    const spec = await facade.getConnectorSpecification({ ...context, connectorName: 'GoogleAds' });
    expect(spec.specification[0]).toEqual({ name: 'Secret', secret: true, oauth: false });
    expect(await facade.getConnectorFields({ ...context, connectorName: 'GoogleAds' })).toEqual({
      connectorName: 'GoogleAds',
      fields: [{ name: 'campaigns', fields: [{ name: 'id' }] }],
    });
  });

  it.each(['create', 'configure', 'validate'])(
    'denies viewer %s before a use-case runs',
    async operation => {
      const { facade, create, update, validate, get } = setup();
      const viewer = { ...context, roles: ['viewer'] };
      const request =
        operation === 'create'
          ? facade.createDataStorage({
              ...viewer,
              storageType: DataStorageType.GOOGLE_BIGQUERY,
              title: 'Warehouse',
            })
          : operation === 'configure'
            ? facade.configureDataStorage({
                ...viewer,
                storageId: 'target',
                title: 'Warehouse',
                config,
              })
            : facade.validateDataStorage({ ...viewer, storageId: 'target' });
      await expect(request).rejects.toMatchObject({ status: 403 });
      expect(create.run).not.toHaveBeenCalled();
      expect(update.run).not.toHaveBeenCalled();
      expect(validate.run).not.toHaveBeenCalled();
      expect(get.run).not.toHaveBeenCalled();
    }
  );

  it('creates the requested title atomically with the owning user', async () => {
    const { facade, create } = setup();
    await facade.createDataStorage({
      ...context,
      storageType: DataStorageType.GOOGLE_BIGQUERY,
      title: ' Ads warehouse ',
    });
    expect(create.run).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: context.projectId,
        userId: context.userId,
        title: 'Ads warehouse',
      })
    );
  });

  it.each([DataStorageType.LEGACY_GOOGLE_BIGQUERY, 'UNSUPPORTED'])(
    'rejects creating %s before persistence',
    async type => {
      const { facade, create } = setup();
      await expect(
        facade.createDataStorage({
          ...context,
          storageType: type as DataStorageType,
          title: 'Warehouse',
        })
      ).rejects.toMatchObject({ status: 400 });
      expect(create.run).not.toHaveBeenCalled();
    }
  );

  it('preserves project and user context when editing and checks entity permissions', async () => {
    const { facade, update, get, access } = setup();
    await facade.configureDataStorage({
      ...context,
      storageId: 'target',
      title: 'New title',
      config,
      credentialId: 'credential-1',
    });
    expect(get.run).toHaveBeenCalledWith(expect.objectContaining({ id: 'target', ...context }));
    expect(access.canAccess).toHaveBeenCalledWith(
      context.userId,
      context.roles,
      EntityType.STORAGE,
      'target',
      Action.EDIT,
      context.projectId
    );
    expect(update.run).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'target',
        ...context,
        title: 'New title',
        config,
        credentials: undefined,
      })
    );
  });

  it('denies entity editing even when the project role is editor', async () => {
    const { facade, access, update } = setup();
    access.canAccess.mockResolvedValue(false);
    await expect(
      facade.configureDataStorage({ ...context, storageId: 'target', title: 'Warehouse', config })
    ).rejects.toMatchObject({ status: 403 });
    expect(update.run).not.toHaveBeenCalled();
  });

  it('delegates safe configuration of an existing legacy storage to the existing update policy', async () => {
    const { facade, get, update } = setup();
    get.run.mockResolvedValue({ ...storage(), type: DataStorageType.LEGACY_GOOGLE_BIGQUERY });
    await facade.configureDataStorage({
      ...context,
      storageId: 'target',
      title: 'Warehouse',
      config,
      credentialId: 'credential-1',
    });
    expect(update.run).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'target', config, ...context })
    );
  });

  it('requires exactly one credential reference before updating storage configuration', async () => {
    const { facade, update } = setup();
    await expect(
      facade.configureDataStorage({
        ...context,
        storageId: 'target',
        title: 'Warehouse',
        config,
      })
    ).rejects.toMatchObject({ status: 400 });
    expect(update.run).not.toHaveBeenCalled();
  });

  it.each([
    { ...config, credentials: { private_key: 'never-return-this' } },
    { ...config, clientSecret: 'never-return-this' },
    { ...config, location: { token: 'never-return-this' } },
    { ...config, location: 'Bearer never-return-this' },
  ])('rejects plaintext credentials hidden in config without echoing input', async unsafeConfig => {
    const { facade, update } = setup();
    const error = await facade
      .configureDataStorage({
        ...context,
        storageId: 'target',
        title: 'Warehouse',
        config: unsafeConfig,
      })
      .catch(e => e);
    expect(error).toBeInstanceOf(HttpException);
    expect(error.getStatus()).toBe(400);
    expect(error.message).not.toContain('never-return-this');
    expect(update.run).not.toHaveBeenCalled();
  });

  it('rejects a cross-project credential before updating', async () => {
    const { facade, credentials, update } = setup();
    credentials.getById.mockResolvedValue(credential({ projectId: 'other-project' }));
    await expect(
      facade.configureDataStorage({
        ...context,
        storageId: 'target',
        title: 'Warehouse',
        config,
        credentialId: 'foreign',
      })
    ).rejects.toMatchObject({ status: 400 });
    expect(update.run).not.toHaveBeenCalled();
  });

  it('rejects an incompatible credential type and reports unknown setup status', async () => {
    const { facade, credentials, update } = setup();
    credentials.getById.mockResolvedValue(credential({ type: StorageCredentialType.AWS_IAM }));
    await expect(
      facade.configureDataStorage({
        ...context,
        storageId: 'target',
        title: 'Warehouse',
        config,
        credentialId: 'credential-1',
      })
    ).rejects.toMatchObject({ status: 400 });
    expect(update.run).not.toHaveBeenCalled();
    expect((await facade.listDataStorages(context)).dataStorages[0].credentialStatus).toBe(
      'unknown'
    );
  });

  it('resolves a credential reference to an accessible same-type storage and checks copy permission', async () => {
    const { facade, list, update, access } = setup();
    list.run.mockResolvedValue([storage('source', 'source-credential')]);
    await facade.configureDataStorage({
      ...context,
      storageId: 'target',
      title: 'Warehouse',
      config,
      credentialId: 'source-credential',
    });
    expect(access.canAccess).toHaveBeenCalledWith(
      context.userId,
      context.roles,
      EntityType.STORAGE,
      'source',
      Action.COPY_CREDENTIALS,
      context.projectId
    );
    expect(update.run).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceStorageId: 'source',
        credentialId: undefined,
        credentials: undefined,
      })
    );
  });

  it('denies copying when only source visibility is granted', async () => {
    const { facade, access, update } = setup();
    access.canAccess.mockImplementation((_user, _roles, _type, _id, action) =>
      Promise.resolve(action !== Action.COPY_CREDENTIALS)
    );
    await expect(
      facade.configureDataStorage({
        ...context,
        storageId: 'target',
        title: 'Warehouse',
        config,
        sourceStorageId: 'source',
      })
    ).rejects.toMatchObject({ status: 403 });
    expect(update.run).not.toHaveBeenCalled();
  });

  it('rejects credentials detached from a visible source storage', async () => {
    const { facade, list, update } = setup();
    list.run.mockResolvedValue([]);
    await expect(
      facade.configureDataStorage({
        ...context,
        storageId: 'target',
        title: 'Warehouse',
        config,
        credentialId: 'unattached',
      })
    ).rejects.toMatchObject({ status: 400 });
    expect(update.run).not.toHaveBeenCalled();
  });

  it('rejects source storage from a different type', async () => {
    const { facade, get, update } = setup();
    get.run.mockImplementation(command =>
      Promise.resolve(
        command.id === 'source'
          ? { ...storage('source'), type: DataStorageType.SNOWFLAKE }
          : storage()
      )
    );
    await expect(
      facade.configureDataStorage({
        ...context,
        storageId: 'target',
        title: 'Warehouse',
        config,
        sourceStorageId: 'source',
      })
    ).rejects.toMatchObject({ status: 400 });
    expect(update.run).not.toHaveBeenCalled();
  });

  it('rejects self-copy and competing references before update', async () => {
    const { facade, update } = setup();
    for (const refs of [
      { sourceStorageId: 'target' },
      { sourceStorageId: 'source', credentialId: 'credential-1' },
    ]) {
      await expect(
        facade.configureDataStorage({
          ...context,
          storageId: 'target',
          title: 'Warehouse',
          config,
          ...refs,
        })
      ).rejects.toMatchObject({ status: 400 });
    }
    expect(update.run).not.toHaveBeenCalled();
  });

  it('validates real access with authenticated context and suppresses upstream details', async () => {
    const { facade, validate } = setup();
    validate.run.mockResolvedValue(
      ValidationResult.failure('secret=never-return-this', { token: 'never-return-this' })
    );
    const result = await facade.validateDataStorage({ ...context, storageId: 'target' });
    expect(validate.run).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'target', ...context })
    );
    expect(result).toMatchObject({ valid: false, setupRequired: true });
    expect(JSON.stringify(result)).not.toContain('never-return-this');
  });

  it.each([
    new NotFoundException('private_key=never-return-this'),
    new ForbiddenException('access_token=never-return-this'),
    new Error('refresh_token=never-return-this'),
  ])('retains safe HTTP semantics without upstream error messages', async upstream => {
    const { facade, get } = setup();
    get.run.mockRejectedValue(upstream);
    const error = await facade
      .validateDataStorage({ ...context, storageId: 'target' })
      .catch(e => e);
    expect(error.getStatus()).toBe(upstream instanceof HttpException ? upstream.getStatus() : 500);
    expect(error.message).not.toContain('never-return-this');
  });
});
