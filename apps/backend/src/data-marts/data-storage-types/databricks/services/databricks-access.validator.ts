import { Injectable, Logger } from '@nestjs/common';
import { DataStorageType } from '../../enums/data-storage-type.enum';
import { DatabricksConfigSchema } from '../schemas/databricks-config.schema';
import { DatabricksCredentialsSchema } from '../schemas/databricks-credentials.schema';
import {
  DataStorageAccessValidator,
  ValidationResult,
} from '../../interfaces/data-storage-access-validator.interface';
import { DataStorageConfig } from '../../data-storage-config.type';
import { DataStorageCredentials } from '../../data-storage-credentials.type';
import { DatabricksApiAdapterFactory } from '../adapters/databricks-api-adapter.factory';

@Injectable()
export class DatabricksAccessValidator implements DataStorageAccessValidator {
  private readonly logger = new Logger(DatabricksAccessValidator.name);
  readonly type = DataStorageType.DATABRICKS;

  constructor(private readonly adapterFactory: DatabricksApiAdapterFactory) {}

  async validate(
    config: DataStorageConfig,
    credentials: DataStorageCredentials
  ): Promise<ValidationResult> {
    const configOpt = DatabricksConfigSchema.safeParse(config);
    if (!configOpt.success) {
      this.logger.log('Invalid config');
      return ValidationResult.failure('Invalid config');
    }

    const credentialsOpt = DatabricksCredentialsSchema.safeParse(credentials);
    if (!credentialsOpt.success) {
      this.logger.log('Invalid credentials');
      return ValidationResult.failure('Invalid credentials');
    }

    const apiAdapter = this.adapterFactory.create(credentialsOpt.data, configOpt.data);
    try {
      await apiAdapter.checkAccess();
      await apiAdapter.destroy();
      return new ValidationResult(true);
    } catch {
      this.logger.log('Access validation failed');
      try {
        await apiAdapter.destroy();
      } catch {
        // Ignore errors during cleanup
      }
      return ValidationResult.failure('Access validation failed');
    }
  }
}
