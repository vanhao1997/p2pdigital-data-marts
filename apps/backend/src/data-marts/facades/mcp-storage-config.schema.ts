import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { DataStorageConfig } from '../data-storage-types/data-storage-config.type';
import { DataStorageType } from '../data-storage-types/enums/data-storage-type.enum';
import { AthenaConfigSchema } from '../data-storage-types/athena/schemas/athena-config.schema';
import { BigQueryConfigSchema } from '../data-storage-types/bigquery/schemas/bigquery-config.schema';
import { DatabricksConfigSchema } from '../data-storage-types/databricks/schemas/databricks-config.schema';
import {
  RedshiftProvisionedConfigSchema,
  RedshiftServerlessConfigSchema,
} from '../data-storage-types/redshift/schemas/redshift-config.schema';
import { SnowflakeConfigSchema } from '../data-storage-types/snowflake/schemas/snowflake-config.schema';

const schemas: Record<DataStorageType, z.ZodType<DataStorageConfig, z.ZodTypeDef, unknown>> = {
  [DataStorageType.GOOGLE_BIGQUERY]: BigQueryConfigSchema.strict(),
  [DataStorageType.LEGACY_GOOGLE_BIGQUERY]: BigQueryConfigSchema.strict(),
  [DataStorageType.AWS_ATHENA]: AthenaConfigSchema.strict(),
  [DataStorageType.SNOWFLAKE]: SnowflakeConfigSchema.strict(),
  [DataStorageType.AWS_REDSHIFT]: z.discriminatedUnion('connectionType', [
    RedshiftServerlessConfigSchema.strict(),
    RedshiftProvisionedConfigSchema.strict(),
  ]),
  [DataStorageType.DATABRICKS]: DatabricksConfigSchema.strict(),
};

// Even allowed config fields must not transport embedded connection credentials.
const safeScalar = z.string().refine(value => {
  if (/-----BEGIN|\bBearer\s|(?:token|password|secret|credential|key|signature)\s*=/i.test(value)) {
    return false;
  }
  if (value.includes('://')) {
    try {
      const url = new URL(value);
      return !url.username && !url.password && !url.search && !url.hash;
    } catch {
      return false;
    }
  }
  return true;
});

export function parseMcpStorageConfig(type: DataStorageType, input: unknown): DataStorageConfig {
  const parsed = schemas[type]?.safeParse(input);
  if (
    !parsed?.success ||
    Object.values(parsed.data).some(value => !safeScalar.safeParse(value).success)
  ) {
    throw new BadRequestException(
      'Invalid storage configuration. Use only the supported non-secret config fields; enter credentials in the web application.'
    );
  }
  return parsed.data;
}
