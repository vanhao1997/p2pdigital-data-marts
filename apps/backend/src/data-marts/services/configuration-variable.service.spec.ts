import { ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { ConfigurationVariableKind } from '../enums/configuration-variable-kind.enum';
import { ConfigurationVariableService } from './configuration-variable.service';

jest.mock('./connector/connector-source-credentials.service', () => ({
  ConnectorSourceCredentialsService: jest.fn(),
}));
jest.mock('./data-mart.service', () => ({ DataMartService: jest.fn() }));
jest.mock('./access-decision', () => ({
  AccessDecisionService: jest.fn(),
  Action: { EDIT: 'EDIT' },
  EntityType: { DATA_MART: 'DATA_MART' },
}));

describe('ConfigurationVariableService', () => {
  const make = () => {
    const repository = {
      find: jest.fn(),
      findOne: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn((value: Record<string, unknown>) => value),
      save: jest.fn(async (value: Record<string, unknown>) => value),
      delete: jest.fn(),
    };
    const connectorCredentials = {
      getCredentialsByProjectId: jest.fn(),
      getCredentialsById: jest.fn(),
      createReusableSecrets: jest.fn(),
      deleteReusableSecret: jest.fn(),
    };
    const dataMartService = { findByProjectIdAndDefinitionType: jest.fn().mockResolvedValue([]) };
    const accessDecisionService = { canAccess: jest.fn().mockResolvedValue(true) };

    return {
      service: new ConfigurationVariableService(
        repository as never,
        connectorCredentials as never,
        dataMartService as never,
        accessDecisionService as never
      ),
      repository,
      connectorCredentials,
      accessDecisionService,
    };
  };

  it('does not expose raw credential payloads in candidate metadata', async () => {
    const { service, connectorCredentials } = make();
    connectorCredentials.getCredentialsByProjectId.mockResolvedValue([
      {
        id: 'credential-1',
        projectId: 'project-1',
        connectorName: 'GoogleAds',
        kind: 'oauth',
        credentials: { access_token: 'must-not-leak' },
        user: {
          email: 'analyst@example.com',
          access_token: 'must-not-leak',
          providerPayload: { refresh_token: 'must-not-leak' },
        },
        createdAt: new Date('2026-09-01T00:00:00Z'),
      },
    ]);

    const result = await service.listCredentialCandidates('project-1', 'user-1', ['admin']);

    expect(result).toEqual([
      expect.objectContaining({
        id: 'credential-1',
        connectorName: 'GoogleAds',
        kind: ConfigurationVariableKind.CREDENTIAL_REFERENCE,
        identity: { email: 'analyst@example.com' },
      }),
    ]);
    expect(result[0]).not.toHaveProperty('credentials');
    expect(result[0].identity).toEqual({ email: 'analyst@example.com' });
    expect(result[0].identity).not.toHaveProperty('access_token');
    expect(result[0].identity).not.toHaveProperty('providerPayload');
  });

  it('copies Data Mart secrets into a project-scoped reusable credential', async () => {
    const { service, connectorCredentials, accessDecisionService, repository } = make();
    connectorCredentials.getCredentialsById.mockResolvedValue({
      id: 'credential-1',
      projectId: 'project-1',
      connectorName: 'GoogleSheets',
      kind: 'secret',
      dataMartId: 'data-mart-1',
      configId: 'config-1',
      credentials: { 'AuthType.service_account.ServiceAccountKey': 'private-key' },
    });
    connectorCredentials.createReusableSecrets.mockResolvedValue({
      id: 'reusable-1',
      projectId: 'project-1',
      connectorName: 'GoogleSheets',
      kind: 'secret',
    });

    await service.create(
      'project-1',
      'user-1',
      {
        name: 'SheetsServiceAccount',
        kind: ConfigurationVariableKind.SECRET_REFERENCE,
        credentialId: 'credential-1',
      },
      ['admin']
    );

    expect(accessDecisionService.canAccess).toHaveBeenCalledWith(
      'user-1',
      ['admin'],
      'DATA_MART',
      'data-mart-1',
      'EDIT',
      'project-1'
    );
    expect(connectorCredentials.createReusableSecrets).toHaveBeenCalledWith(
      'project-1',
      'GoogleSheets',
      { 'AuthType.service_account.ServiceAccountKey': 'private-key' },
      'user-1'
    );
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ credentialId: 'reusable-1', projectId: 'project-1' })
    );
  });

  it('allows a credential reference from another project', async () => {
    const { service, connectorCredentials, repository } = make();
    connectorCredentials.getCredentialsById.mockResolvedValue({
      id: 'credential-1',
      projectId: 'project-2',
      connectorName: 'GoogleAds',
      kind: 'oauth',
    });

    await expect(
      service.create('project-1', 'user-1', {
        name: 'AdsOAuth',
        kind: ConfigurationVariableKind.CREDENTIAL_REFERENCE,
        credentialId: 'credential-1',
      })
    ).resolves.toEqual(
      expect.objectContaining({
        name: 'AdsOAuth',
        credentialId: 'credential-1',
      })
    );
    expect(repository.save).toHaveBeenCalled();
  });

  it('maps a concurrent duplicate insert to a conflict response', async () => {
    const { service, repository } = make();
    repository.save.mockRejectedValue(
      new QueryFailedError('INSERT', [], { code: 'ER_DUP_ENTRY' } as Error)
    );

    await expect(
      service.create('project-1', 'user-1', {
        name: 'SharedCustomerId',
        kind: ConfigurationVariableKind.VALUE,
        value: '123',
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('cleans up the copied secret when variable creation fails', async () => {
    const { service, repository, connectorCredentials } = make();
    connectorCredentials.getCredentialsById.mockResolvedValue({
      id: 'source-secret',
      projectId: 'project-1',
      connectorName: 'GoogleSheets',
      kind: 'secret',
      dataMartId: 'data-mart-1',
      credentials: { token: 'secret' },
    });
    connectorCredentials.createReusableSecrets.mockResolvedValue({
      id: 'reusable-secret-1',
      projectId: 'project-1',
      connectorName: 'GoogleSheets',
      kind: 'secret',
    });
    repository.save.mockRejectedValue(new Error('database unavailable'));

    await expect(
      service.create('project-1', 'user-1', {
        name: 'SheetsSecret',
        kind: ConfigurationVariableKind.SECRET_REFERENCE,
        credentialId: 'source-secret',
      })
    ).rejects.toThrow('database unavailable');
    expect(connectorCredentials.deleteReusableSecret).toHaveBeenCalledWith(
      'project-1',
      'reusable-secret-1'
    );
  });

  it('reclaims an owned reusable secret after deleting its last variable', async () => {
    const { service, repository, connectorCredentials } = make();
    repository.findOne.mockResolvedValue({
      id: 'variable-1',
      projectId: 'project-1',
      kind: ConfigurationVariableKind.SECRET_REFERENCE,
      credentialId: 'reusable-secret-1',
    });
    repository.count.mockResolvedValue(0);

    await service.remove('project-1', 'variable-1');

    expect(repository.delete).toHaveBeenCalledWith('variable-1');
    expect(connectorCredentials.deleteReusableSecret).toHaveBeenCalledWith(
      'project-1',
      'reusable-secret-1'
    );
  });
});
