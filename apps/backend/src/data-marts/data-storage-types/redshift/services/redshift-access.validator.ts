import { Injectable } from '@nestjs/common';
import {
  DataStorageAccessValidator,
  ValidationResult,
} from '../../interfaces/data-storage-access-validator.interface';
import { DataStorageType } from '../../enums/data-storage-type.enum';
import { DataStorageConfig } from '../../data-storage-config.type';
import { DataStorageCredentials } from '../../data-storage-credentials.type';
import { RedshiftApiAdapterFactory } from '../adapters/redshift-api-adapter.factory';
import { RedshiftConfigSchema } from '../schemas/redshift-config.schema';
import { RedshiftCredentialsSchema } from '../schemas/redshift-credentials.schema';

@Injectable()
export class RedshiftAccessValidator implements DataStorageAccessValidator {
  readonly type = DataStorageType.AWS_REDSHIFT;

  constructor(private readonly adapterFactory: RedshiftApiAdapterFactory) {}

  async validate(
    config: DataStorageConfig,
    credentials: DataStorageCredentials
  ): Promise<ValidationResult> {
    const configResult = RedshiftConfigSchema.safeParse(config);
    if (!configResult.success) {
      return ValidationResult.failure('Invalid config');
    }

    const credentialsResult = RedshiftCredentialsSchema.safeParse(credentials);
    if (!credentialsResult.success) {
      return ValidationResult.failure('Invalid credentials');
    }

    const adapter = this.adapterFactory.create(credentialsResult.data, configResult.data);

    try {
      await adapter.checkAccess();
      return new ValidationResult(true);
    } catch {
      return ValidationResult.failure('Access validation failed');
    }
  }
}
