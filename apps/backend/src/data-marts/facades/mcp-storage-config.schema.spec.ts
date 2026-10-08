import { DataStorageType } from '../data-storage-types/enums/data-storage-type.enum';
import { parseMcpStorageConfig } from './mcp-storage-config.schema';

describe('parseMcpStorageConfig', () => {
  it.each([
    [DataStorageType.GOOGLE_BIGQUERY, { projectId: 'warehouse-project' }],
    [DataStorageType.AWS_ATHENA, { region: 'us-east-1', outputBucket: 's3://results/' }],
    [DataStorageType.SNOWFLAKE, { account: 'account', warehouse: 'warehouse' }],
    [
      DataStorageType.AWS_REDSHIFT,
      { connectionType: 'SERVERLESS', region: 'us-east-1', database: 'db', workgroupName: 'wg' },
    ],
    [
      DataStorageType.AWS_REDSHIFT,
      {
        connectionType: 'PROVISIONED',
        region: 'us-east-1',
        database: 'db',
        clusterIdentifier: 'cluster',
      },
    ],
    [
      DataStorageType.DATABRICKS,
      { host: 'https://workspace.cloud.databricks.com', httpPath: '/sql/1.0/warehouses/abc' },
    ],
  ])('accepts supported non-secret %s configuration', (type, input) => {
    expect(parseMcpStorageConfig(type as DataStorageType, input)).toMatchObject(input);
  });

  it.each([
    { host: 'https://user:DO_NOT_RETURN@workspace.cloud.databricks.com', httpPath: '/sql/abc' },
    { host: 'https://workspace.cloud.databricks.com?token=DO_NOT_RETURN', httpPath: '/sql/abc' },
    { host: 'workspace.cloud.databricks.com', httpPath: '/sql/abc?password=DO_NOT_RETURN' },
    {
      host: 'workspace.cloud.databricks.com',
      httpPath: '/sql/abc',
      credentials: { token: 'DO_NOT_RETURN' },
    },
  ])('rejects credential-bearing config without reflecting the input', input => {
    try {
      parseMcpStorageConfig(DataStorageType.DATABRICKS, input);
      throw new Error('Expected rejection');
    } catch (error) {
      expect((error as Error).message).not.toContain('DO_NOT_RETURN');
      expect((error as Error).message).toContain('Invalid storage configuration');
    }
  });
});
