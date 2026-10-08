jest.mock('../bigquery/adapters/bigquery-api.adapter', () => ({ BigQueryApiAdapter: jest.fn() }));
jest.mock('../snowflake/adapters/snowflake-api.adapter', () => ({
  SnowflakeApiAdapter: jest.fn(),
}));
jest.mock('../athena/adapters/athena-api-adapter.factory', () => ({
  AthenaApiAdapterFactory: jest.fn(),
}));
jest.mock('../redshift/adapters/redshift-api-adapter.factory', () => ({
  RedshiftApiAdapterFactory: jest.fn(),
}));
jest.mock('../databricks/adapters/databricks-api-adapter.factory', () => ({
  DatabricksApiAdapterFactory: jest.fn(),
}));

import { Logger } from '@nestjs/common';
import { AthenaAccessValidator } from '../athena/services/athena-access.validator';
import { BigQueryAccessValidator } from '../bigquery/services/bigquery-access.validator';
import { BigQueryApiAdapter } from '../bigquery/adapters/bigquery-api.adapter';
import { BIGQUERY_OAUTH_TYPE } from '../bigquery/schemas/bigquery-credentials.schema';
import { DatabricksAccessValidator } from '../databricks/services/databricks-access.validator';
import { RedshiftAccessValidator } from '../redshift/services/redshift-access.validator';
import { SnowflakeAccessValidator } from '../snowflake/services/snowflake-access.validator';
import { SnowflakeApiAdapter } from '../snowflake/adapters/snowflake-api.adapter';
import type { DataStorageAccessValidator } from '../interfaces/data-storage-access-validator.interface';

describe('Storage access validation secret redaction', () => {
  const secret = 'DO_NOT_RETURN_PROVIDER_TOKEN';
  const adapter = () => ({
    checkAccess: jest.fn().mockRejectedValue(new Error(`token=${secret}`)),
    destroy: jest.fn().mockResolvedValue(undefined),
  });

  const build = (
    name: string
  ): {
    validator: DataStorageAccessValidator;
    config: unknown;
    credentials: unknown;
    fake: ReturnType<typeof adapter>;
  } => {
    const fake = adapter();
    const factory = { create: jest.fn().mockReturnValue(fake) };
    switch (name) {
      case 'Athena':
        return {
          validator: new AthenaAccessValidator(factory as never),
          config: { region: 'us-east-1', outputBucket: 's3://results' },
          credentials: { accessKeyId: 'key', secretAccessKey: secret },
          fake,
        };
      case 'BigQuery':
        (BigQueryApiAdapter as jest.Mock).mockImplementation(() => fake);
        return {
          validator: new BigQueryAccessValidator(),
          config: { projectId: 'warehouse-project' },
          credentials: {
            type: 'service_account',
            project_id: 'warehouse-project',
            private_key_id: 'key-id',
            private_key: `-----BEGIN PRIVATE KEY-----\n${secret}\n-----END PRIVATE KEY-----`,
            client_email: 'test@example.com',
            client_id: 'client-id',
            client_x509_cert_url: 'https://example.com/cert',
          },
          fake,
        };
      case 'Snowflake':
        (SnowflakeApiAdapter as jest.Mock).mockImplementation(() => fake);
        return {
          validator: new SnowflakeAccessValidator(),
          config: { account: 'account', warehouse: 'warehouse' },
          credentials: { authMethod: 'PASSWORD', username: 'user', password: secret },
          fake,
        };
      case 'Redshift':
        return {
          validator: new RedshiftAccessValidator(factory as never),
          config: {
            connectionType: 'SERVERLESS',
            region: 'us-east-1',
            database: 'database',
            workgroupName: 'workgroup',
          },
          credentials: { accessKeyId: 'key', secretAccessKey: secret },
          fake,
        };
      case 'Databricks':
        return {
          validator: new DatabricksAccessValidator(factory as never),
          config: { host: 'workspace.cloud.databricks.com', httpPath: '/sql/warehouse' },
          credentials: { authMethod: 'PERSONAL_ACCESS_TOKEN', token: secret },
          fake,
        };
      default:
        throw new Error('Unknown fixture');
    }
  };

  let log: jest.SpyInstance;
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;
  beforeEach(() => {
    log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it.each(['Athena', 'BigQuery', 'Snowflake', 'Redshift', 'Databricks'])(
    '%s driver failure never leaks provider errors',
    async name => {
      const { validator, config, credentials, fake } = build(name);
      const result = await validator.validate(config as never, credentials as never);
      expect(fake.checkAccess).toHaveBeenCalled();
      expect(result).toMatchObject({ valid: false, errorMessage: 'Access validation failed' });
      expect(JSON.stringify(result)).not.toContain(secret);
      expect(
        [log, warn, error]
          .flatMap(spy => spy.mock.calls.flat())
          .map(String)
          .join(' ')
      ).not.toContain(secret);
    }
  );

  it.each(['Athena', 'BigQuery', 'Snowflake', 'Redshift', 'Databricks'])(
    '%s schema failure never logs raw credential values',
    async name => {
      const { validator, config, fake } = build(name);
      const result = await validator.validate(
        config as never,
        { authMethod: secret, type: secret } as never
      );
      expect(result.valid).toBe(false);
      expect(fake.checkAccess).not.toHaveBeenCalled();
      expect(JSON.stringify(result)).not.toContain(secret);
      expect(
        [log, warn, error]
          .flatMap(spy => spy.mock.calls.flat())
          .map(String)
          .join(' ')
      ).not.toContain(secret);
    }
  );

  it('BigQuery OAuth error response and logger redact provider tokens', async () => {
    const { validator, config } = build('BigQuery');
    const result = await validator.validate(
      config as never,
      { type: BIGQUERY_OAUTH_TYPE, oauth2Client: {} } as never
    );
    expect(result).toMatchObject({ valid: false, errorMessage: 'OAuth access validation failed' });
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(warn.mock.calls.flat().map(String).join(' ')).not.toContain(secret);
  });
});
