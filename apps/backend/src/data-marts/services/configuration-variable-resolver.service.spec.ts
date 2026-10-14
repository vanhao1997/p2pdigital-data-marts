import { ConfigurationVariableResolverService } from './configuration-variable-resolver.service';
import { ConfigurationVariableKind } from '../enums/configuration-variable-kind.enum';

// The resolver receives this dependency through DI; keep the unit test from
// loading the full connector bundle just to exercise marker resolution.
jest.mock('./connector/connector-source-credentials.service', () => ({
  ConnectorSourceCredentialsService: jest.fn(),
}));
jest.mock('./configuration-variable.service', () => ({
  ConfigurationVariableService: jest.fn(),
}));

describe('ConfigurationVariableResolverService', () => {
  const make = () => {
    const variables = { resolve: jest.fn() };
    const credentials = { getCredentialsById: jest.fn() };
    return {
      service: new ConfigurationVariableResolverService(variables as any, credentials as any),
      variables,
      credentials,
    };
  };

  it('resolves a safe value marker without exposing credential data', async () => {
    const { service, variables } = make();
    variables.resolve.mockResolvedValue({
      id: 'var-1',
      projectId: 'project-1',
      name: 'CustomerId',
      kind: ConfigurationVariableKind.VALUE,
      value: '123',
    });

    await expect(
      service.resolveConnectorConfig(
        { CustomerId: { _variable_id: 'var-1' } },
        'project-1',
        'GoogleAds'
      )
    ).resolves.toEqual({ CustomerId: '123' });
  });

  it('resolves an OAuth reference only when the credential matches project and connector', async () => {
    const { service, variables, credentials } = make();
    variables.resolve.mockResolvedValue({
      id: 'var-1',
      projectId: 'project-1',
      name: 'AdsOAuth',
      kind: ConfigurationVariableKind.CREDENTIAL_REFERENCE,
      credentialId: 'credential-1',
    });
    credentials.getCredentialsById.mockResolvedValue({
      id: 'credential-1',
      projectId: 'project-1',
      connectorName: 'GoogleAds',
      kind: 'oauth',
      credentials: { access_token: 'redacted-in-test' },
    });

    await expect(
      service.resolveConnectorConfig(
        { AuthType: { _credential_variable_id: 'var-1' } },
        'project-1',
        'GoogleAds'
      )
    ).resolves.toEqual({ AuthType: { _source_credential_id: 'credential-1' } });
  });

  it('resolves a shared credential reference from another project', async () => {
    const { service, variables, credentials } = make();
    variables.resolve.mockResolvedValue({
      id: 'var-1',
      projectId: 'project-2',
      kind: ConfigurationVariableKind.SECRET_REFERENCE,
      credentialId: 'credential-1',
    });
    credentials.getCredentialsById.mockResolvedValue({
      id: 'credential-1',
      projectId: 'project-2',
      connectorName: 'GoogleAds',
      kind: 'secret',
      credentials: { token: 'redacted-in-test' },
    });

    await expect(
      service.resolveConnectorConfig({ _secrets_variable_id: 'var-1' }, 'project-1', 'GoogleAds')
    ).resolves.toEqual({ _secrets_id: 'credential-1' });
  });

  it('keeps an opaque runtime reference and expands a reusable secret only for save', async () => {
    const { service, variables, credentials } = make();
    variables.resolve.mockResolvedValue({
      id: 'var-1',
      projectId: 'project-1',
      kind: ConfigurationVariableKind.SECRET_REFERENCE,
      credentialId: 'credential-1',
    });
    credentials.getCredentialsById.mockResolvedValue({
      id: 'credential-1',
      projectId: 'project-1',
      connectorName: 'GoogleSheets',
      kind: 'secret',
      credentials: { 'AuthType.service_account.ServiceAccountKey': 'private-key' },
    });

    await expect(
      service.resolveConnectorConfig({ _secrets_variable_id: 'var-1' }, 'project-1', 'GoogleSheets')
    ).resolves.toEqual({ _secrets_id: 'credential-1' });
    await expect(
      service.resolveConnectorConfigForSave(
        { _id: 'config-1', _secrets_variable_id: 'var-1' },
        'project-1',
        'GoogleSheets'
      )
    ).resolves.toEqual({
      _id: 'config-1',
      AuthType: { service_account: { ServiceAccountKey: 'private-key' } },
    });
  });
});
