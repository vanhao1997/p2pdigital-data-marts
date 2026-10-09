import { DataStorageType } from '../data-storage-types/enums/data-storage-type.enum';
import { ValidationResult } from '../data-storage-types/interfaces/data-storage-access-validator.interface';
import { DataStorageDto } from '../dto/domain/data-storage.dto';
import { McpSetupStoragesMapper } from './mcp-setup-storages.mapper';

describe('McpSetupStoragesMapper', () => {
  const mapper = new McpSetupStoragesMapper();

  it('normalizes missing optional connector metadata to nullable output', () => {
    expect(mapper.toConnector({ name: 'GoogleAds', title: 'Google Ads' } as never)).toEqual({
      name: 'GoogleAds',
      title: 'Google Ads',
      description: null,
      logo: null,
      docUrl: null,
    });
  });

  it('returns only the validated opaque credential reference and safe storage metadata', () => {
    const dto = new DataStorageDto(
      'storage',
      'Warehouse',
      DataStorageType.GOOGLE_BIGQUERY,
      'project',
      { projectId: 'warehouse-project', location: 'US' },
      new Date(),
      new Date(),
      0,
      0,
      'private-reference'
    );
    const result = mapper.toStorage(dto, 'configured');
    expect(Object.keys(result).sort()).toEqual([
      'credentialId',
      'credentialStatus',
      'setupRequired',
      'storageId',
      'storageType',
      'title',
    ]);
    expect(result.credentialId).toBe('private-reference');
    expect(JSON.stringify(result)).not.toContain('warehouse-project');
    expect(mapper.toStorage(dto, 'unknown')).not.toHaveProperty('credentialId');
    expect(mapper.toStorage(dto, 'missing')).not.toHaveProperty('credentialId');
  });

  it('removes secret defaults, placeholders, options and OAuth/env payloads at every level', () => {
    const result = mapper.toSpecification([
      {
        name: 'Auth',
        requiredType: 'object',
        default: { secret: 'DO_NOT_RETURN' },
        oauthParams: { vars: { ClientSecret: { value: 'DO_NOT_RETURN', key: 'ENV_SECRET' } } },
        oneOf: [
          {
            label: 'OAuth',
            value: 'oauth',
            attributes: ['OAUTH_FLOW'],
            oauthParams: { value: 'DO_NOT_RETURN' },
            items: {
              Token: {
                name: 'Token',
                attributes: ['SECRET'],
                default: 'DO_NOT_RETURN',
                placeholder: 'DO_NOT_RETURN',
                options: ['DO_NOT_RETURN'],
              },
              Account: {
                name: 'Account',
                default: 'account-id',
                placeholder: 'Account ID',
                required: true,
              },
            },
          },
        ],
      },
    ]);
    const json = JSON.stringify(result);
    expect(json).not.toContain('DO_NOT_RETURN');
    expect(json).not.toContain('ENV_SECRET');
    expect(json).not.toContain('oauthParams');
    expect(result[0].oneOf?.[0]).toMatchObject({ oauth: true });
    expect(result[0].oneOf?.[0].items.Account).toMatchObject({ oauth: true, required: true });
    expect(result[0].oneOf?.[0].items.Account.default).toBeUndefined();
    expect(result[0].oneOf?.[0].items.Account.placeholder).toBeUndefined();
  });

  it('redacts defaults, options and placeholders inherited from an OAuth branch', () => {
    const result = mapper.toSpecification([
      {
        name: 'Auth',
        oneOf: [
          {
            label: 'OAuth',
            value: 'oauth',
            attributes: ['OAUTH_FLOW'],
            items: {
              ClientId: {
                name: 'ClientId',
                default: 'OAUTH_CANARY',
                options: ['OAUTH_CANARY'],
                placeholder: 'OAUTH_CANARY',
              },
            },
          },
        ],
      },
    ]);
    expect(result[0].oneOf?.[0].items.ClientId.oauth).toBe(true);
    expect(JSON.stringify(result)).not.toContain('OAUTH_CANARY');
  });

  it('inherits secret redaction from secret branch parents', () => {
    const result = mapper.toSpecification([
      {
        name: 'Auth',
        attributes: ['SECRET'],
        oneOf: [
          {
            label: 'Credentials',
            value: 'credentials',
            items: { key: { name: 'key', default: 'DO_NOT_RETURN' } },
          },
        ],
      },
    ]);
    expect(result[0].oneOf?.[0].items.key.secret).toBe(true);
    expect(JSON.stringify(result)).not.toContain('DO_NOT_RETURN');
  });

  it('keeps safe connector fields but drops samples, credentials and execution logs', () => {
    const result = mapper.toFields([
      {
        name: 'campaigns',
        fields: [{ name: 'id', label: 'ID', type: 'string', sample: 'DO_NOT_RETURN' }],
        logs: ['DO_NOT_RETURN'],
        credentials: { key: 'DO_NOT_RETURN' },
      },
    ] as never);
    expect(result).toEqual([
      { name: 'campaigns', fields: [{ name: 'id', label: 'ID', type: 'string' }] },
    ]);
  });

  it('maps OAuth reauthorization to a safe setup-required status', () => {
    const storage = {
      storageId: 'storage',
      title: 'Warehouse',
      storageType: DataStorageType.GOOGLE_BIGQUERY,
      credentialStatus: 'configured' as const,
      setupRequired: false,
    };
    const result = mapper.toValidation(
      storage,
      ValidationResult.oauthReauthRequired('refresh_token=DO_NOT_RETURN')
    );
    expect(result).toMatchObject({
      credentialStatus: 'expired',
      setupRequired: true,
      valid: false,
      code: 'OAUTH_REAUTH_REQUIRED',
    });
    expect(JSON.stringify(result)).not.toContain('DO_NOT_RETURN');
  });
});
