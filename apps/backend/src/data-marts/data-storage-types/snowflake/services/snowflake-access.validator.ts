import { Injectable, Logger } from '@nestjs/common';
import { DataStorageType } from '../../enums/data-storage-type.enum';
import { SnowflakeConfigSchema } from '../schemas/snowflake-config.schema';
import { SnowflakeCredentialsSchema } from '../schemas/snowflake-credentials.schema';
import {
  DataStorageAccessValidator,
  ValidationResult,
} from '../../interfaces/data-storage-access-validator.interface';
import { DataStorageConfig } from '../../data-storage-config.type';
import { DataStorageCredentials } from '../../data-storage-credentials.type';
import { SnowflakeApiAdapter } from '../adapters/snowflake-api.adapter';

@Injectable()
export class SnowflakeAccessValidator implements DataStorageAccessValidator {
  private readonly logger = new Logger(SnowflakeAccessValidator.name);
  readonly type = DataStorageType.SNOWFLAKE;

  async validate(
    config: DataStorageConfig,
    credentials: DataStorageCredentials
  ): Promise<ValidationResult> {
    const configOpt = SnowflakeConfigSchema.safeParse(config);
    if (!configOpt.success) {
      this.logger.log('Invalid config');
      return ValidationResult.failure('Invalid config');
    }

    const credentialsOpt = SnowflakeCredentialsSchema.safeParse(credentials);
    if (!credentialsOpt.success) {
      this.logger.log('Invalid credentials');
      return ValidationResult.failure('Invalid credentials');
    }

    const snowflakeConfig = configOpt.data;
    const apiAdapter = new SnowflakeApiAdapter(credentialsOpt.data, snowflakeConfig);
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
