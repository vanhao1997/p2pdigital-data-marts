import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import type { McpScope } from '@owox/idp-protocol';
import { PublicOriginService } from '../../../common/config/public-origin.service';
import {
  MCP_SETUP_DATA_MARTS_FACADE,
  type McpSetupDataMartsFacade,
} from '../../../data-marts/facades/mcp-setup-data-marts.facade';
import type { McpAuthContext } from '../auth/mcp-auth-context';
import { mapDataMartSetup } from '../mappers/mcp-setup-output.mapper';
import { jsonToolResult, type McpToolDefinition, type McpToolResult } from './mcp-tool.definition';
import {
  createDataMartInputSchema,
  updateDataMartInputSchema,
  dataMartSetupInputSchema,
  dataMartSetupOutputSchema,
  setupErrorSchema,
} from './mcp-setup.schemas';

const writeAnnotations = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };

@Injectable()
export class CreateDataMartTool implements McpToolDefinition {
  readonly name = 'create_data_mart';
  readonly description =
    'Creates a DRAFT Data Mart using an existing accessible warehouse. Optional definition_type and definition must be supplied together: SQL {sqlQuery}, TABLE/VIEW {fullyQualifiedName}, TABLE_PATTERN {pattern}, or CONNECTOR {connector:{source:{name,configuration,node,fields},storage:{fullyQualifiedName}}}. Discover connector specification and fields first. Never send plaintext secrets; complete OAuth/secret entry in the returned web URL or reuse authorized saved references. This never publishes. If setup_error is returned, continue with the returned data_mart_id; never retry create.';
  readonly zodSchema = createDataMartInputSchema.shape;
  readonly outputSchema = dataMartSetupOutputSchema.shape;
  readonly annotations = { title: 'Create Data Mart Draft', ...writeAnnotations };
  readonly requiredScopes: McpScope[] = ['mcp:write'];

  constructor(
    @Inject(MCP_SETUP_DATA_MARTS_FACADE) private readonly facade: McpSetupDataMartsFacade,
    private readonly origin: PublicOriginService
  ) {}

  async handler(input: unknown, context: McpAuthContext): Promise<McpToolResult> {
    const parsed = createDataMartInputSchema.parse(input);
    const result = await this.facade.createDataMart({
      projectId: context.projectId,
      userId: context.userId,
      roles: context.roles,
      title: parsed.title,
      storageId: parsed.storage_id,
      description: parsed.description,
      definitionType: parsed.definition_type,
      definition: parsed.definition,
      sourceDataMartId: parsed.source_data_mart_id,
      sourceConfigurationId: parsed.source_configuration_id,
    });
    return jsonToolResult(
      mapDataMartSetup(result, context.projectId, this.origin.getPublicOrigin())
    );
  }
}

@Injectable()
export class UpdateDataMartTool implements McpToolDefinition {
  readonly name = 'update_data_mart';
  readonly description =
    'Updates title, description or definition using existing Data Mart edit/credential-copy permissions. A definition change requires both definition_type and definition. Storage is chosen at creation. For connector credential reuse provide paired source_data_mart_id and source_configuration_id, or existing authorized configuration-variable references. Never send raw _secrets_id, _source_credential_id or plaintext secrets. Validate after changing the definition. This does not publish or start a sync. If setup_error is returned, continue with the existing data_mart_id.';
  readonly zodSchema = updateDataMartInputSchema.shape;
  readonly outputSchema = dataMartSetupOutputSchema.shape;
  readonly annotations = { title: 'Update Data Mart', ...writeAnnotations };
  readonly requiredScopes: McpScope[] = ['mcp:write'];

  constructor(
    @Inject(MCP_SETUP_DATA_MARTS_FACADE) private readonly facade: McpSetupDataMartsFacade,
    private readonly origin: PublicOriginService
  ) {}

  async handler(input: unknown, context: McpAuthContext): Promise<McpToolResult> {
    const parsed = updateDataMartInputSchema.parse(input);
    const result = await this.facade.updateDataMart({
      projectId: context.projectId,
      userId: context.userId,
      roles: context.roles,
      dataMartId: parsed.data_mart_id,
      title: parsed.title,
      description: parsed.description,
      definitionType: parsed.definition_type,
      definition: parsed.definition,
      sourceDataMartId: parsed.source_data_mart_id,
      sourceConfigurationId: parsed.source_configuration_id,
    });
    return jsonToolResult(
      mapDataMartSetup(result, context.projectId, this.origin.getPublicOrigin())
    );
  }
}

@Injectable()
export class ValidateDataMartTool implements McpToolDefinition {
  readonly name = 'validate_data_mart';
  readonly description =
    'Validates the saved Data Mart definition using its existing warehouse/provider configuration before publishing. Requires write scope and edit permissions. Returns safe validation results and a web setup URL. Does not publish or run a connector sync; missing/expired credentials must first be completed in the web application.';
  readonly zodSchema = dataMartSetupInputSchema.shape;
  readonly outputSchema = {
    data_mart: dataMartSetupOutputSchema,
    valid: z.boolean(),
    error: setupErrorSchema.optional(),
  };
  readonly annotations = { title: 'Validate Data Mart', ...writeAnnotations, openWorldHint: true };
  readonly requiredScopes: McpScope[] = ['mcp:write'];

  constructor(
    @Inject(MCP_SETUP_DATA_MARTS_FACADE) private readonly facade: McpSetupDataMartsFacade,
    private readonly origin: PublicOriginService
  ) {}

  async handler(input: unknown, context: McpAuthContext): Promise<McpToolResult> {
    const parsed = dataMartSetupInputSchema.parse(input);
    const result = await this.facade.validateDataMart({
      projectId: context.projectId,
      userId: context.userId,
      roles: context.roles,
      dataMartId: parsed.data_mart_id,
    });
    return jsonToolResult({
      data_mart: mapDataMartSetup(
        result.dataMart,
        context.projectId,
        this.origin.getPublicOrigin()
      ),
      valid: result.valid,
      ...(result.error
        ? { error: { code: result.error.code, message: result.error.message } }
        : {}),
    });
  }
}

@Injectable()
export class PublishDataMartTool implements McpToolDefinition {
  readonly name = 'publish_data_mart';
  readonly description =
    'Publishes an existing DRAFT Data Mart through the normal publish service, after definition validation. Call ONLY when the user explicitly requests publishing this Data Mart; creation/configuration is not authorization to publish. Publishing a CONNECTOR Data Mart may immediately start an incremental run, write warehouse data and incur consumption under the existing billing policy. Report connector_run_may_start and inspect get_data_mart_setup_status; publication does not prove sync completion.';
  readonly zodSchema = dataMartSetupInputSchema.shape;
  readonly outputSchema = {
    ...dataMartSetupOutputSchema.shape,
    connector_run_may_start: z.boolean(),
  };
  readonly annotations = {
    title: 'Publish Data Mart',
    readOnlyHint: false,
    destructiveHint: true,
    openWorldHint: true,
  };
  readonly requiredScopes: McpScope[] = ['mcp:write'];

  constructor(
    @Inject(MCP_SETUP_DATA_MARTS_FACADE) private readonly facade: McpSetupDataMartsFacade,
    private readonly origin: PublicOriginService
  ) {}

  async handler(input: unknown, context: McpAuthContext): Promise<McpToolResult> {
    const parsed = dataMartSetupInputSchema.parse(input);
    const result = await this.facade.publishDataMart({
      projectId: context.projectId,
      userId: context.userId,
      roles: context.roles,
      dataMartId: parsed.data_mart_id,
    });
    return jsonToolResult({
      ...mapDataMartSetup(result, context.projectId, this.origin.getPublicOrigin()),
      connector_run_may_start: result.connectorRunMayStart,
    });
  }
}

@Injectable()
export class GetDataMartSetupStatusTool implements McpToolDefinition {
  readonly name = 'get_data_mart_setup_status';
  readonly description =
    'Returns accessible draft/published Data Mart setup status, definition type, warehouse ID, credential status and latest run metadata. No raw definition, credentials, rows or run logs are returned. Use after web OAuth/setup and after publishing to observe readiness and sync status.';
  readonly zodSchema = dataMartSetupInputSchema.shape;
  readonly outputSchema = dataMartSetupOutputSchema.shape;
  readonly annotations = {
    title: 'Get Data Mart Setup Status',
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false,
  };
  readonly requiredScopes: McpScope[] = ['mcp:read'];

  constructor(
    @Inject(MCP_SETUP_DATA_MARTS_FACADE) private readonly facade: McpSetupDataMartsFacade,
    private readonly origin: PublicOriginService
  ) {}

  async handler(input: unknown, context: McpAuthContext): Promise<McpToolResult> {
    const parsed = dataMartSetupInputSchema.parse(input);
    const result = await this.facade.getDataMartSetupStatus({
      projectId: context.projectId,
      userId: context.userId,
      roles: context.roles,
      dataMartId: parsed.data_mart_id,
    });
    return jsonToolResult(
      mapDataMartSetup(result, context.projectId, this.origin.getPublicOrigin())
    );
  }
}
