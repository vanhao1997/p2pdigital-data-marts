import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import type { McpScope } from '@owox/idp-protocol';
import { PublicOriginService } from '../../../common/config/public-origin.service';
import {
  MCP_SETUP_STORAGES_FACADE,
  type McpSetupStoragesFacade,
} from '../../../data-marts/facades/mcp-setup-storages.facade';
import type { McpAuthContext } from '../auth/mcp-auth-context';
import { mapStorageSetup } from '../mappers/mcp-setup-output.mapper';
import { jsonToolResult, type McpToolDefinition, type McpToolResult } from './mcp-tool.definition';
import {
  emptySetupInputSchema,
  connectorSetupInputSchema,
  storageSetupInputSchema,
  createDataStorageInputSchema,
  configureDataStorageInputShape,
  configureDataStorageInputSchema,
  dataStorageSetupOutputSchema,
  connectorSummaryOutputSchema,
  connectorSpecificationOutputSchema,
  connectorFieldGroupOutputSchema,
} from './mcp-setup.schemas';

const readAnnotations = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
const writeAnnotations = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };

@Injectable()
export class ListDataStoragesTool implements McpToolDefinition {
  readonly name = 'list_data_storages';
  readonly description =
    'Lists warehouses accessible in the authenticated project, with credential setup status, authorized opaque credential IDs and web configuration URLs. Use the returned credential_id to configure its own storage after web authentication. Never guess IDs. No credential payloads or raw configuration are returned.';
  readonly zodSchema = emptySetupInputSchema.shape;
  readonly outputSchema = { data_storages: z.array(dataStorageSetupOutputSchema) };
  readonly annotations = { title: 'List Data Storages', ...readAnnotations };
  readonly requiredScopes: McpScope[] = ['mcp:read'];

  constructor(
    @Inject(MCP_SETUP_STORAGES_FACADE) private readonly facade: McpSetupStoragesFacade,
    private readonly origin: PublicOriginService
  ) {}

  async handler(input: unknown, context: McpAuthContext): Promise<McpToolResult> {
    emptySetupInputSchema.parse(input);
    const result = await this.facade.listDataStorages({
      projectId: context.projectId,
      userId: context.userId,
      roles: context.roles,
    });
    return jsonToolResult({
      data_storages: result.dataStorages.map(dto =>
        mapStorageSetup(dto, context.projectId, this.origin.getPublicOrigin())
      ),
    });
  }
}

@Injectable()
export class ListConnectorsTool implements McpToolDefinition {
  readonly name = 'list_connectors';
  readonly description =
    'Lists existing source connectors supported by this server. Select an exact connector name, then call get_connector_specification and get_connector_fields before building a connector Data Mart definition.';
  readonly zodSchema = emptySetupInputSchema.shape;
  readonly outputSchema = { connectors: z.array(connectorSummaryOutputSchema) };
  readonly annotations = { title: 'List Connectors', ...readAnnotations };
  readonly requiredScopes: McpScope[] = ['mcp:read'];

  constructor(@Inject(MCP_SETUP_STORAGES_FACADE) private readonly facade: McpSetupStoragesFacade) {}

  async handler(input: unknown, context: McpAuthContext): Promise<McpToolResult> {
    emptySetupInputSchema.parse(input);
    const result = await this.facade.listConnectors({
      projectId: context.projectId,
      userId: context.userId,
      roles: context.roles,
    });
    return jsonToolResult({
      connectors: z.array(connectorSummaryOutputSchema).parse(result.connectors),
    });
  }
}

@Injectable()
export class GetConnectorSpecificationTool implements McpToolDefinition {
  readonly name = 'get_connector_specification';
  readonly description =
    'Returns safe configuration metadata for an existing connector, including required fields and secret/OAuth markers. Secret defaults and OAuth parameters are omitted. Complete secret entry and OAuth in the web application; never send plaintext credentials through MCP.';
  readonly zodSchema = connectorSetupInputSchema.shape;
  readonly outputSchema = {
    connector_name: z.string(),
    specification: z.array(connectorSpecificationOutputSchema),
  };
  readonly annotations = { title: 'Get Connector Specification', ...readAnnotations };
  readonly requiredScopes: McpScope[] = ['mcp:read'];

  constructor(@Inject(MCP_SETUP_STORAGES_FACADE) private readonly facade: McpSetupStoragesFacade) {}

  async handler(input: unknown, context: McpAuthContext): Promise<McpToolResult> {
    const parsed = connectorSetupInputSchema.parse(input);
    const result = await this.facade.getConnectorSpecification({
      projectId: context.projectId,
      userId: context.userId,
      roles: context.roles,
      connectorName: parsed.connector_name,
    });
    return jsonToolResult({
      connector_name: result.connectorName,
      specification: z.array(connectorSpecificationOutputSchema).parse(result.specification),
    });
  }
}

@Injectable()
export class GetConnectorFieldsTool implements McpToolDefinition {
  readonly name = 'get_connector_fields';
  readonly description =
    'Returns existing connector nodes and native field metadata. Copy node and field names exactly when creating a CONNECTOR definition; metadata discovery does not start a provider sync.';
  readonly zodSchema = connectorSetupInputSchema.shape;
  readonly outputSchema = {
    connector_name: z.string(),
    fields: z.array(connectorFieldGroupOutputSchema),
  };
  readonly annotations = { title: 'Get Connector Fields', ...readAnnotations };
  readonly requiredScopes: McpScope[] = ['mcp:read'];

  constructor(@Inject(MCP_SETUP_STORAGES_FACADE) private readonly facade: McpSetupStoragesFacade) {}

  async handler(input: unknown, context: McpAuthContext): Promise<McpToolResult> {
    const parsed = connectorSetupInputSchema.parse(input);
    const result = await this.facade.getConnectorFields({
      projectId: context.projectId,
      userId: context.userId,
      roles: context.roles,
      connectorName: parsed.connector_name,
    });
    return jsonToolResult({
      connector_name: result.connectorName,
      fields: z.array(connectorFieldGroupOutputSchema).parse(result.fields),
    });
  }
}

@Injectable()
export class CreateDataStorageTool implements McpToolDefinition {
  readonly name = 'create_data_storage';
  readonly description =
    'Creates an unconfigured warehouse in the authenticated project. Supports existing storage types; creating legacy Google BigQuery storage is refused. List storages first to avoid duplicates. Returns a web setup URL for credentials/OAuth, never secrets.';
  readonly zodSchema = createDataStorageInputSchema.shape;
  readonly outputSchema = dataStorageSetupOutputSchema.shape;
  readonly annotations = { title: 'Create Data Storage', ...writeAnnotations };
  readonly requiredScopes: McpScope[] = ['mcp:write'];

  constructor(
    @Inject(MCP_SETUP_STORAGES_FACADE) private readonly facade: McpSetupStoragesFacade,
    private readonly origin: PublicOriginService
  ) {}

  async handler(input: unknown, context: McpAuthContext): Promise<McpToolResult> {
    const parsed = createDataStorageInputSchema.parse(input);
    const result = await this.facade.createDataStorage({
      projectId: context.projectId,
      userId: context.userId,
      roles: context.roles,
      storageType: parsed.storage_type,
      title: parsed.title,
    });
    return jsonToolResult(
      mapStorageSetup(result, context.projectId, this.origin.getPublicOrigin())
    );
  }
}

@Injectable()
export class ConfigureDataStorageTool implements McpToolDefinition {
  readonly name = 'configure_data_storage';
  readonly description =
    'Updates a warehouse title and supported non-secret configuration. Provide exactly one credential_id attached to an accessible same-type storage or source_storage_id with credential-copy permission in this project. New credentials and OAuth must be entered/completed in the returned web setup URL. Validate after setup; do not proceed while credential_status is missing or expired.';
  readonly zodSchema = configureDataStorageInputShape;
  readonly outputSchema = dataStorageSetupOutputSchema.shape;
  readonly annotations = { title: 'Configure Data Storage', ...writeAnnotations };
  readonly requiredScopes: McpScope[] = ['mcp:write'];

  constructor(
    @Inject(MCP_SETUP_STORAGES_FACADE) private readonly facade: McpSetupStoragesFacade,
    private readonly origin: PublicOriginService
  ) {}

  async handler(input: unknown, context: McpAuthContext): Promise<McpToolResult> {
    const parsed = configureDataStorageInputSchema.parse(input);
    const result = await this.facade.configureDataStorage({
      projectId: context.projectId,
      userId: context.userId,
      roles: context.roles,
      storageId: parsed.storage_id,
      title: parsed.title,
      config: parsed.config,
      credentialId: parsed.credential_id,
      sourceStorageId: parsed.source_storage_id,
    });
    return jsonToolResult(
      mapStorageSetup(result, context.projectId, this.origin.getPublicOrigin())
    );
  }
}

@Injectable()
export class ValidateDataStorageTool implements McpToolDefinition {
  readonly name = 'validate_data_storage';
  readonly description =
    'Validates warehouse configuration and actual provider access using existing credentials. Requires write scope and storage use permission. Safe errors include web setup instructions; no credentials, raw provider errors or data rows are returned. This does not run a connector sync.';
  readonly zodSchema = storageSetupInputSchema.shape;
  readonly outputSchema = {
    ...dataStorageSetupOutputSchema.shape,
    valid: z.boolean(),
    code: z.enum(['UNCONFIGURED', 'OAUTH_REAUTH_REQUIRED']).optional(),
    message: z.string().optional(),
  };
  readonly annotations = {
    title: 'Validate Data Storage',
    ...writeAnnotations,
    openWorldHint: true,
  };
  readonly requiredScopes: McpScope[] = ['mcp:write'];

  constructor(
    @Inject(MCP_SETUP_STORAGES_FACADE) private readonly facade: McpSetupStoragesFacade,
    private readonly origin: PublicOriginService
  ) {}

  async handler(input: unknown, context: McpAuthContext): Promise<McpToolResult> {
    const parsed = storageSetupInputSchema.parse(input);
    const result = await this.facade.validateDataStorage({
      projectId: context.projectId,
      userId: context.userId,
      roles: context.roles,
      storageId: parsed.storage_id,
    });
    return jsonToolResult({
      ...mapStorageSetup(result, context.projectId, this.origin.getPublicOrigin()),
      valid: result.valid,
      ...(result.code ? { code: result.code } : {}),
      ...(result.message ? { message: result.message } : {}),
    });
  }
}
