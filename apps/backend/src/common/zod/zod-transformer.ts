import { ValueTransformer } from 'typeorm';
import { ZodTypeAny } from 'zod';

const VALID_DATA_MART_SCHEMA_TYPES = new Set([
  'bigquery-data-mart-schema',
  'athena-data-mart-schema',
  'snowflake-data-mart-schema',
  'redshift-data-mart-schema',
  'databricks-data-mart-schema',
]);

const VALID_BQ_FIELD_TYPES = new Set([
  'INTEGER',
  'FLOAT',
  'NUMERIC',
  'BIGNUMERIC',
  'STRING',
  'BYTES',
  'BOOLEAN',
  'DATE',
  'TIME',
  'DATETIME',
  'TIMESTAMP',
  'GEOGRAPHY',
  'JSON',
  'RECORD',
  'STRUCT',
  'RANGE',
  'INTERVAL',
]);

const VALID_BQ_MODES = new Set(['NULLABLE', 'REQUIRED', 'REPEATED']);
const VALID_FIELD_STATUSES = new Set([
  'CONNECTED',
  'CONNECTED_WITH_DEFINITION_MISMATCH',
  'DISCONNECTED',
]);

function normalizeBqField(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const f = { ...(raw as Record<string, unknown>) };
  f.name = String(f.name || 'field');
  let type = String(f.type || 'STRING').toUpperCase();
  if (['INT64', 'INT', 'SMALLINT', 'BIGINT', 'TINYINT', 'BYTEINT'].includes(type)) {
    type = 'INTEGER';
  } else if (['FLOAT64', 'NUMBER', 'DOUBLE'].includes(type)) {
    type = 'FLOAT';
  } else if (type === 'DECIMAL') {
    type = 'NUMERIC';
  } else if (type === 'BIGDECIMAL') {
    type = 'BIGNUMERIC';
  } else if (type === 'BOOL') {
    type = 'BOOLEAN';
  }
  f.type = VALID_BQ_FIELD_TYPES.has(type) ? type : 'STRING';
  const mode = String(f.mode || 'NULLABLE').toUpperCase();
  f.mode = VALID_BQ_MODES.has(mode) ? mode : 'NULLABLE';
  const status = String(f.status || 'CONNECTED').toUpperCase();
  f.status = VALID_FIELD_STATUSES.has(status) ? status : 'CONNECTED';
  f.isPrimaryKey = Boolean(f.isPrimaryKey);
  f.isHiddenForReporting = Boolean(f.isHiddenForReporting);
  if (f.alias === null || f.alias === '' || typeof f.alias !== 'string') {
    delete f.alias;
  }
  if (f.description === null || typeof f.description !== 'string') {
    delete f.description;
  }
  if (Array.isArray(f.fields)) {
    f.fields = f.fields.map(normalizeBqField).filter(Boolean);
  } else {
    delete f.fields;
  }
  return f;
}

function normalizeLegacyValue(value: unknown): unknown {
  let parsed = value;
  while (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      break;
    }
  }
  if (Array.isArray(parsed)) {
    parsed = { type: 'bigquery-data-mart-schema', fields: parsed };
  }
  if (!parsed || typeof parsed !== 'object') {
    return value;
  }
  const obj = { ...(parsed as Record<string, unknown>) };
  if ('fields' in obj || !('type' in obj)) {
    const schemaType =
      typeof obj.type === 'string' && VALID_DATA_MART_SCHEMA_TYPES.has(obj.type)
        ? obj.type
        : 'bigquery-data-mart-schema';
    const rawFields = Array.isArray(obj.fields) ? obj.fields : [];
    return {
      ...obj,
      type: schemaType,
      fields:
        schemaType === 'bigquery-data-mart-schema'
          ? rawFields.map(normalizeBqField).filter(Boolean)
          : rawFields,
    };
  }
  if (obj.type === 'GOOGLE_SHEETS' || obj.type === 'google_sheets') {
    obj.type = 'google-sheets-config';
  } else if (obj.type === 'LOOKER_STUDIO' || obj.type === 'looker_studio') {
    obj.type = 'looker-studio-config';
  }
  return obj;
}

/**
 * Creates a value transformer that uses a Zod schema for validation.
 *
 * @param {ZodTypeAny} schema - The Zod schema used to validate and transform the value.
 * @param {boolean} isRequired - If entity presence is strictly required.
 * @return {ValueTransformer} A value transformer object that validates data using the provided schema during both `to` and `from` operations.
 */
export function createZodTransformer<T>(
  schema: ZodTypeAny,
  isRequired: boolean = true
): ValueTransformer {
  return {
    to(value: T): T {
      // validate before save
      if (!isRequired && (value === null || value === undefined)) {
        return value;
      }
      return schema.parse(value);
    },
    from(value: unknown): T {
      // validate after load
      if (!isRequired && (value === null || value === undefined)) {
        return value as T;
      }
      try {
        return schema.parse(value);
      } catch (err) {
        try {
          return schema.parse(normalizeLegacyValue(value));
        } catch {
          if (!isRequired) {
            return null as unknown as T;
          }
          throw err;
        }
      }
    },
  };
}
