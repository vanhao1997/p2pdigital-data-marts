import { Inject, Injectable } from '@nestjs/common';
import type { McpScope } from '@owox/idp-protocol';
import { PublicOriginService } from '../../../common/config/public-origin.service';
import { DataMartDefinitionType } from '../../../data-marts/enums/data-mart-definition-type.enum';
import {
  MCP_SETUP_DATA_MARTS_FACADE,
  type McpSetupDataMartsFacade,
} from '../../../data-marts/facades/mcp-setup-data-marts.facade';
import type { McpAuthContext } from '../auth/mcp-auth-context';
import { mapConnectorDefinition } from '../mappers/mcp-connector-input.mapper';
import { mapDataMartSetup } from '../mappers/mcp-setup-output.mapper';
import { jsonToolResult, type McpToolDefinition, type McpToolResult } from './mcp-tool.definition';
import {
  createConnectorInputSchema,
  configureConnectorInputSchema,
  dataMartSetupOutputSchema,
} from './mcp-setup.schemas';

const annotations = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };

@Injectable()
export class CreateConnectorTool implements McpToolDefinition {
  readonly name = 'create_connector';
  readonly description =
    'Creates a platform connector as a CONNECTOR Data Mart in DRAFT status, not a new provider integration. Supports the providers returned by list_connectors; fetch get_connector_specification and get_connector_fields first. Select an existing storage and ask the user for the warehouse target. Pass only non-secret configuration, or authorized source_data_mart_id/source_configuration_id references. Complete OAuth, passwords and API tokens through configuration_url, never in chat/MCP. Returns data_mart_id and credential/setup status. This never validates, publishes, runs sync or creates schedules. On setup_error resume with this ID using configure_connector; never retry create.';
  readonly zodSchema = createConnectorInputSchema.shape;
  readonly outputSchema = dataMartSetupOutputSchema.shape;
  readonly annotations = { title: 'Create Platform Connector Draft', ...annotations };
  readonly requiredScopes: McpScope[] = ['mcp:write'];

  constructor(
    @Inject(MCP_SETUP_DATA_MARTS_FACADE) private readonly facade: McpSetupDataMartsFacade,
    private readonly origin: PublicOriginService
  ) {}

  async handler(input: unknown, context: McpAuthContext): Promise<McpToolResult> {
    const parsed = createConnectorInputSchema.parse(input);
    const result = await this.facade.createDataMart({
      projectId: context.projectId,
      userId: context.userId,
      roles: context.roles,
      title: parsed.title,
      storageId: parsed.storage_id,
      description: parsed.description,
      definitionType: DataMartDefinitionType.CONNECTOR,
      definition: mapConnectorDefinition(parsed),
      sourceDataMartId: parsed.source_data_mart_id,
      sourceConfigurationId: parsed.source_configuration_id,
    });
    return jsonToolResult(
      mapDataMartSetup(result, context.projectId, this.origin.getPublicOrigin())
    );
  }
}

@Injectable()
export class ConfigureConnectorTool implements McpToolDefinition {
  readonly name = 'configure_connector';
  readonly description =
    'Saves a complete connector definition on an existing empty draft or connector Data Mart. Use its existing data_mart_id; do not create a duplicate. Fetch the exact provider specification, node and native fields first. Keep existing configuration _id values returned by get_data_mart_setup_status to preserve authorized credentials; credential reuse requires same-project same-provider source_data_mart_id and source_configuration_id. Omitted configurations are removed: confirm replacement before calling. Plaintext secrets and raw credential pointers are refused; complete authentication in configuration_url. Existing storage cannot be changed. Does not validate, publish, run sync or create schedules; configuring a published connector does not stop existing scheduled runs.';
  readonly zodSchema = configureConnectorInputSchema.shape;
  readonly outputSchema = dataMartSetupOutputSchema.shape;
  readonly annotations = {
    title: 'Configure Platform Connector',
    ...annotations,
    destructiveHint: true,
  };
  readonly requiredScopes: McpScope[] = ['mcp:write'];

  constructor(
    @Inject(MCP_SETUP_DATA_MARTS_FACADE) private readonly facade: McpSetupDataMartsFacade,
    private readonly origin: PublicOriginService
  ) {}

  async handler(input: unknown, context: McpAuthContext): Promise<McpToolResult> {
    const parsed = configureConnectorInputSchema.parse(input);
    const result = await this.facade.updateDataMart({
      projectId: context.projectId,
      userId: context.userId,
      roles: context.roles,
      dataMartId: parsed.data_mart_id,
      definitionType: DataMartDefinitionType.CONNECTOR,
      definition: mapConnectorDefinition(parsed),
      sourceDataMartId: parsed.source_data_mart_id,
      sourceConfigurationId: parsed.source_configuration_id,
    });
    return jsonToolResult(
      mapDataMartSetup(result, context.projectId, this.origin.getPublicOrigin())
    );
  }
}
