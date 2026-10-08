import { z } from 'zod';
import { DataStorageType } from '../../../data-marts/data-storage-types/enums/data-storage-type.enum';
import { DataMartDefinitionType } from '../../../data-marts/enums/data-mart-definition-type.enum';
import { SqlDefinitionSchema } from '../../../data-marts/dto/schemas/data-mart-table-definitions/sql-definition.schema';
import { TableDefinitionSchema } from '../../../data-marts/dto/schemas/data-mart-table-definitions/table-definition.schema';
import { ViewDefinitionSchema } from '../../../data-marts/dto/schemas/data-mart-table-definitions/view-definition.schema';
import { TablePatternDefinitionSchema } from '../../../data-marts/dto/schemas/data-mart-table-definitions/table-pattern-definition.schema';
import {
  ConnectorSourceSchema,
  ConnectorStorageSchema,
} from '../../../data-marts/dto/schemas/data-mart-table-definitions/connector-definition.schema';

export const setupIdSchema = z.string().trim().min(1).max(256);
export const setupTitleSchema = z.string().trim().min(1).max(255);
export const emptySetupInputSchema = z.object({}).strict();
export const connectorSetupInputSchema = z.object({ connector_name: setupIdSchema }).strict();
export const storageSetupInputSchema = z.object({ storage_id: setupIdSchema }).strict();
export const dataMartSetupInputSchema = z.object({ data_mart_id: setupIdSchema }).strict();
export const createDataStorageInputSchema = z
  .object({ storage_type: z.nativeEnum(DataStorageType), title: setupTitleSchema })
  .strict();
export const configureDataStorageInputShape = {
  storage_id: setupIdSchema,
  title: setupTitleSchema,
  config: z.record(z.unknown()).describe('Supported non-secret warehouse configuration only.'),
  credential_id: setupIdSchema.optional(),
  source_storage_id: setupIdSchema.optional(),
};
export const configureDataStorageInputSchema = z
  .object(configureDataStorageInputShape)
  .strict()
  .refine(value => Boolean(value.credential_id) !== Boolean(value.source_storage_id), {
    message: 'Provide exactly one credential reference.',
  });

export const mcpSetupDefinitionSchema = z.union([
  SqlDefinitionSchema.strict(),
  TableDefinitionSchema.strict(),
  ViewDefinitionSchema.strict(),
  TablePatternDefinitionSchema.strict(),
  z
    .object({
      connector: z
        .object({
          source: ConnectorSourceSchema.strict(),
          storage: ConnectorStorageSchema.strict(),
        })
        .strict(),
    })
    .strict(),
]);
const definitionInputShape = {
  definition_type: z.nativeEnum(DataMartDefinitionType).optional(),
  definition: mcpSetupDefinitionSchema.optional(),
  source_data_mart_id: setupIdSchema.optional(),
  source_configuration_id: setupIdSchema.optional(),
};
export const createDataMartInputSchema = z
  .object({
    title: setupTitleSchema,
    storage_id: setupIdSchema,
    description: z.string().max(10000).optional(),
    ...definitionInputShape,
  })
  .strict();
export const updateDataMartInputSchema = z
  .object({
    data_mart_id: setupIdSchema,
    title: setupTitleSchema.optional(),
    description: z.string().max(10000).optional(),
    ...definitionInputShape,
  })
  .strict();

export const credentialStatusSchema = z.enum(['missing', 'configured', 'expired', 'unknown']);
export const dataStorageSetupOutputSchema = z
  .object({
    storage_id: z.string(),
    title: z.string(),
    storage_type: z.nativeEnum(DataStorageType),
    credential_status: credentialStatusSchema,
    setup_required: z.boolean(),
    configuration_url: z.string().url(),
  })
  .strict();
export const setupErrorSchema = z.object({ code: z.string(), message: z.string() }).strict();
export const dataMartSetupOutputSchema = z
  .object({
    data_mart_id: z.string(),
    title: z.string(),
    description: z.string().optional(),
    status: z.enum(['DRAFT', 'PUBLISHED']),
    definition_type: z.nativeEnum(DataMartDefinitionType).optional(),
    storage_id: z.string(),
    credential_status: credentialStatusSchema,
    setup_required: z.boolean(),
    configuration_url: z.string().url(),
    connector: z
      .object({ name: z.string(), configuration_ids: z.array(z.string()) })
      .strict()
      .optional(),
    latest_run: z
      .object({ id: z.string(), status: z.string(), type: z.string(), created_at: z.string() })
      .strict()
      .optional(),
    setup_error: setupErrorSchema.optional(),
  })
  .strict();
export const connectorSummaryOutputSchema = z
  .object({
    name: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    logo: z.string().nullable(),
    docUrl: z.string().nullable(),
  })
  .strict();
const specificationBaseSchema = z.object({
  name: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  requiredType: z
    .enum(['string', 'number', 'boolean', 'bool', 'object', 'array', 'date'])
    .optional(),
  required: z.boolean().optional(),
  secret: z.boolean(),
  oauth: z.boolean(),
  default: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]).optional(),
  options: z.array(z.string()).optional(),
  placeholder: z.string().optional(),
  minimum: z.number().optional(),
});

// Bounded nesting keeps the exported JSON Schema finite without exposing arbitrary payloads.
function specificationSchema(depth: number): z.ZodTypeAny {
  return specificationBaseSchema
    .extend({
      oneOf: z
        .array(
          z
            .object({
              label: z.string(),
              value: z.string(),
              requiredType: specificationBaseSchema.shape.requiredType,
              secret: z.boolean(),
              oauth: z.boolean(),
              items: z.record(depth > 0 ? specificationSchema(depth - 1) : z.never()),
            })
            .strict()
        )
        .optional(),
    })
    .strict();
}
export const connectorSpecificationOutputSchema = specificationSchema(6);
export const connectorFieldGroupOutputSchema = z
  .object({
    name: z.string(),
    overview: z.string().optional(),
    description: z.string().optional(),
    documentation: z.string().optional(),
    uniqueKeys: z.array(z.string()).optional(),
    uniqueKeysByDataLevel: z.record(z.array(z.string())).optional(),
    defaultFields: z.array(z.string()).optional(),
    destinationName: z.string().optional(),
    fields: z
      .array(
        z
          .object({
            name: z.string(),
            label: z.string().optional(),
            type: z.string().optional(),
            description: z.string().optional(),
          })
          .strict()
      )
      .optional(),
  })
  .strict();
