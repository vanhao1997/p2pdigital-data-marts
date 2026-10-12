import type { z } from 'zod';
import type { ConnectorDefinition } from '../../../data-marts/dto/schemas/data-mart-table-definitions/connector-definition.schema';
import type { configureConnectorInputSchema } from '../tools/mcp-setup.schemas';

export function mapConnectorDefinition(
  input: Omit<z.infer<typeof configureConnectorInputSchema>, 'data_mart_id'>
): ConnectorDefinition {
  return {
    connector: {
      source: {
        name: input.connector_name,
        configuration: input.configuration,
        node: input.node,
        fields: input.fields,
      },
      storage: { fullyQualifiedName: input.fully_qualified_name },
    },
  };
}
