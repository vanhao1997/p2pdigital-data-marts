import { DataStorageType } from '../data-storage-types/enums/data-storage-type.enum';
import { DataMartDto } from '../dto/domain/data-mart.dto';
import { DataStorageDto } from '../dto/domain/data-storage.dto';
import { DataMartDefinitionType } from '../enums/data-mart-definition-type.enum';
import { DataMartStatus } from '../enums/data-mart-status.enum';
import { McpSetupDataMartsMapper } from './mcp-setup-data-marts.mapper';

describe('McpSetupDataMartsMapper', () => {
  it('exposes only configuration IDs, metadata and status from a secret-bearing definition', () => {
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
      'private-test-secret'
    );
    const dto = new DataMartDto(
      'mart-a',
      'Sales',
      DataMartStatus.DRAFT,
      storage,
      new Date(),
      new Date(),
      DataMartDefinitionType.CONNECTOR,
      {
        connector: {
          source: {
            name: 'GoogleAds',
            node: 'campaign',
            fields: ['id'],
            configuration: [
              {
                _id: 'config-a',
                _secrets_id: 'private-test-secret',
                ApiKey: 'private-test-secret',
              },
              { ApiKey: 'private-test-secret' },
            ],
          },
          storage: { fullyQualifiedName: 'warehouse.dataset.sales' },
        },
      }
    );
    const result = new McpSetupDataMartsMapper().toSetupDto(dto, 'project-a', 'missing');
    expect(result.connector).toEqual({ name: 'GoogleAds', configurationIds: ['config-a'] });
    expect(result.configurationUrl).toBe('/ui/project-a/data-marts/mart-a/data-setup');
    expect(result.setupRequired).toBe(true);
    expect(JSON.stringify(result)).not.toContain('private-test-secret');
    expect(result).not.toHaveProperty('definition');
    expect(result).not.toHaveProperty('storage');
  });

  it('omits a null legacy description instead of returning a non-contract value', () => {
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
      'credential-a'
    );
    const dto = new DataMartDto(
      'mart-a',
      'Sales',
      DataMartStatus.DRAFT,
      storage,
      new Date(),
      new Date(),
      DataMartDefinitionType.SQL,
      { sqlQuery: 'SELECT 1' },
      null as unknown as string
    );
    const result = new McpSetupDataMartsMapper().toSetupDto(dto, 'project-a', 'configured');
    expect(result).not.toHaveProperty('description');
  });
});
