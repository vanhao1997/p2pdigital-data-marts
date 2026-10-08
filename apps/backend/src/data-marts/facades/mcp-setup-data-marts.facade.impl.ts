import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { castError } from '@owox/internal-helpers';
import { z } from 'zod';
import { BusinessViolationException } from '../../common/exceptions/business-violation.exception';
import { DataStorageType } from '../data-storage-types/enums/data-storage-type.enum';
import { ConnectorSpecification } from '../connector-types/connector-specification';
import { CreateDataMartCommand } from '../dto/domain/create-data-mart.command';
import { DataMartDto } from '../dto/domain/data-mart.dto';
import { GetDataMartCommand } from '../dto/domain/get-data-mart.command';
import { GetDataMartRunsCommand } from '../dto/domain/get-data-mart-runs.command';
import { PublishDataMartCommand } from '../dto/domain/publish-data-mart.command';
import { UpdateDataMartDefinitionCommand } from '../dto/domain/update-data-mart-definition.command';
import { UpdateDataMartDescriptionCommand } from '../dto/domain/update-data-mart-description.command';
import { UpdateDataMartTitleCommand } from '../dto/domain/update-data-mart-title.command';
import { ValidateDataMartDefinitionCommand } from '../dto/domain/validate-data-mart-definition.command';
import {
  ConnectorDefinition,
  ConnectorDefinitionSchema,
} from '../dto/schemas/data-mart-table-definitions/connector-definition.schema';
import { DataMartDefinition } from '../dto/schemas/data-mart-table-definitions/data-mart-definition';
import { SqlDefinitionSchema } from '../dto/schemas/data-mart-table-definitions/sql-definition.schema';
import { TableDefinitionSchema } from '../dto/schemas/data-mart-table-definitions/table-definition.schema';
import { TablePatternDefinitionSchema } from '../dto/schemas/data-mart-table-definitions/table-pattern-definition.schema';
import { ViewDefinitionSchema } from '../dto/schemas/data-mart-table-definitions/view-definition.schema';
import { DataMartDefinitionType } from '../enums/data-mart-definition-type.enum';
import { DataMartStatus } from '../enums/data-mart-status.enum';
import { StorageCredentialType } from '../enums/storage-credential-type.enum';
import { McpSetupDataMartsMapper } from '../mappers/mcp-setup-data-marts.mapper';
import { AccessDecisionService, Action, EntityType } from '../services/access-decision';
import {
  ConnectorSecretService,
  SECRET_MASK,
} from '../services/connector/connector-secret.service';
import { ConnectorSourceCredentialsService } from '../services/connector/connector-source-credentials.service';
import { ConnectorService } from '../services/connector/connector.service';
import { DataStorageService } from '../services/data-storage.service';
import { DataStorageCredentialService } from '../services/data-storage-credential.service';
import { CreateDataMartService } from '../use-cases/create-data-mart.service';
import { GetDataMartService } from '../use-cases/get-data-mart.service';
import { ListDataMartRunsService } from '../use-cases/list-data-mart-runs.service';
import { PublishDataMartService } from '../use-cases/publish-data-mart.service';
import { UpdateDataMartDefinitionService } from '../use-cases/update-data-mart-definition.service';
import { UpdateDataMartDescriptionService } from '../use-cases/update-data-mart-description.service';
import { UpdateDataMartTitleService } from '../use-cases/update-data-mart-title.service';
import { ValidateDataMartDefinitionService } from '../use-cases/validate-data-mart-definition.service';
import {
  McpCreateDataMartRequest,
  McpDataMartActor,
  McpDataMartCredentialStatus,
  McpDataMartDefinitionInput,
  McpDataMartSetup,
  McpDataMartSetupRequest,
  McpPublishDataMartResponse,
  McpSetupDataMartsFacade,
  McpUpdateDataMartRequest,
  McpValidateDataMartResponse,
} from './mcp-setup-data-marts.facade';

const ConnectorSetupDefinitionSchema = ConnectorDefinitionSchema.extend({
  connector: ConnectorDefinitionSchema.shape.connector
    .extend({
      source: ConnectorDefinitionSchema.shape.connector.shape.source.strict(),
      storage: ConnectorDefinitionSchema.shape.connector.shape.storage.strict(),
    })
    .strict(),
}).strict();

const definitionSchemas: Record<DataMartDefinitionType, z.ZodType<DataMartDefinition>> = {
  [DataMartDefinitionType.SQL]: SqlDefinitionSchema.strict(),
  [DataMartDefinitionType.TABLE]: TableDefinitionSchema.strict(),
  [DataMartDefinitionType.VIEW]: ViewDefinitionSchema.strict(),
  [DataMartDefinitionType.TABLE_PATTERN]: TablePatternDefinitionSchema.strict(),
  [DataMartDefinitionType.CONNECTOR]: ConnectorSetupDefinitionSchema,
};

const savedVariableMarkers = new Set([
  '_variable_id',
  '_secrets_variable_id',
  '_credential_variable_id',
]);
const forbiddenConfigurationKeys = new Set([
  '_secrets_id',
  '_source_credential_id',
  '_copiedFrom',
  '__proto__',
  'constructor',
  'prototype',
]);
const secretLikeConfigurationKey =
  /^(?:access[\s_-]?token|refresh[\s_-]?token|client[\s_-]?secret|private[\s_-]?key|api[\s_-]?key|token|secret|password|credential(?:s)?|authorization|bearer|cookie)$/i;
const storageCredentialTypes: Record<DataStorageType, StorageCredentialType[]> = {
  [DataStorageType.GOOGLE_BIGQUERY]: [
    StorageCredentialType.GOOGLE_SERVICE_ACCOUNT,
    StorageCredentialType.GOOGLE_OAUTH,
  ],
  [DataStorageType.LEGACY_GOOGLE_BIGQUERY]: [
    StorageCredentialType.GOOGLE_SERVICE_ACCOUNT,
    StorageCredentialType.GOOGLE_OAUTH,
  ],
  [DataStorageType.AWS_ATHENA]: [StorageCredentialType.AWS_IAM],
  [DataStorageType.AWS_REDSHIFT]: [StorageCredentialType.AWS_IAM],
  [DataStorageType.SNOWFLAKE]: [
    StorageCredentialType.SNOWFLAKE_PASSWORD,
    StorageCredentialType.SNOWFLAKE_KEY_PAIR,
  ],
  [DataStorageType.DATABRICKS]: [StorageCredentialType.DATABRICKS_PAT],
};

@Injectable()
export class McpSetupDataMartsFacadeImpl implements McpSetupDataMartsFacade {
  constructor(
    private readonly createDataMartService: CreateDataMartService,
    private readonly updateDefinitionService: UpdateDataMartDefinitionService,
    private readonly updateTitleService: UpdateDataMartTitleService,
    private readonly updateDescriptionService: UpdateDataMartDescriptionService,
    private readonly validateDefinitionService: ValidateDataMartDefinitionService,
    private readonly publishDataMartService: PublishDataMartService,
    private readonly getDataMartService: GetDataMartService,
    private readonly listRunsService: ListDataMartRunsService,
    private readonly dataStorageService: DataStorageService,
    private readonly storageCredentialService: DataStorageCredentialService,
    private readonly connectorService: ConnectorService,
    private readonly connectorSecretService: ConnectorSecretService,
    private readonly connectorCredentialsService: ConnectorSourceCredentialsService,
    private readonly accessDecisionService: AccessDecisionService,
    private readonly mapper: McpSetupDataMartsMapper
  ) {}

  async createDataMart(request: McpCreateDataMartRequest): Promise<McpDataMartSetup> {
    this.assertMutationActor(request);
    const title = this.parseTitle(request.title);
    this.parseDescription(request.description);
    const definition = await this.prepareDefinitionSafely(request, request);

    let dataMart: DataMartDto;
    try {
      if (
        !(await this.accessDecisionService.canAccess(
          request.userId,
          request.roles,
          EntityType.STORAGE,
          request.storageId,
          Action.USE,
          request.projectId
        ))
      ) {
        throw new ForbiddenException('Storage permission is required for creating a Data Mart');
      }
      await this.dataStorageService.getByProjectIdAndId(request.projectId, request.storageId);
      dataMart = await this.createDataMartService.run(
        new CreateDataMartCommand(
          request.projectId,
          request.userId,
          title,
          request.storageId,
          request.roles
        )
      );
    } catch (error) {
      throw this.safeException(error);
    }

    // Existing use-cases commit independently and may have external effects. Return the saved
    // ID on a later failure so the client resumes setup instead of creating duplicate drafts.
    try {
      if (definition) dataMart = await this.saveDefinition(request, dataMart.id, definition);
      if (request.description !== undefined) {
        dataMart = await this.updateDescriptionService.run(
          new UpdateDataMartDescriptionCommand(
            dataMart.id,
            request.projectId,
            request.description,
            request.userId,
            request.roles
          )
        );
      }
    } catch {
      return this.partialResult(request, dataMart);
    }
    return this.mapSetup(request, dataMart);
  }

  async updateDataMart(request: McpUpdateDataMartRequest): Promise<McpDataMartSetup> {
    this.assertMutationActor(request);
    const title = request.title !== undefined ? this.parseTitle(request.title) : undefined;
    this.parseDescription(request.description);
    if (
      request.title === undefined &&
      request.description === undefined &&
      request.definition === undefined &&
      request.definitionType === undefined
    ) {
      throw new BadRequestException('At least one Data Mart field is required');
    }
    let dataMart = await this.getAccessibleDataMart(request);
    await this.assertEditAccess(request, dataMart.id);
    const definition = await this.prepareDefinitionSafely(request, request);
    if (
      definition &&
      request.definitionType === DataMartDefinitionType.CONNECTOR &&
      !request.sourceDataMartId &&
      dataMart.definitionType === DataMartDefinitionType.CONNECTOR &&
      dataMart.definition &&
      'connector' in dataMart.definition &&
      'connector' in definition &&
      dataMart.definition.connector.source.name === definition.connector.source.name
    ) {
      try {
        await this.preserveOwnedOAuthReferences(request, dataMart, definition);
      } catch (error) {
        throw this.safeException(error);
      }
    }
    try {
      if (definition) dataMart = await this.saveDefinition(request, dataMart.id, definition);
      if (request.title !== undefined) {
        dataMart = await this.updateTitleService.run(
          new UpdateDataMartTitleCommand(
            dataMart.id,
            request.projectId,
            title!,
            request.userId,
            request.roles
          )
        );
      }
      if (request.description !== undefined) {
        dataMart = await this.updateDescriptionService.run(
          new UpdateDataMartDescriptionCommand(
            dataMart.id,
            request.projectId,
            request.description,
            request.userId,
            request.roles
          )
        );
      }
    } catch {
      return this.partialResult(request, dataMart);
    }
    return this.mapSetup(request, dataMart);
  }

  async getDataMartSetupStatus(request: McpDataMartSetupRequest): Promise<McpDataMartSetup> {
    this.assertActor(request);
    const dataMart = await this.getAccessibleDataMart(request);
    let runs;
    try {
      runs = await this.listRunsService.run(
        new GetDataMartRunsCommand(
          request.dataMartId,
          request.projectId,
          1,
          0,
          request.userId,
          request.roles
        )
      );
    } catch (error) {
      throw this.safeException(error);
    }
    return this.mapper.toSetupDto(
      dataMart,
      request.projectId,
      await this.credentialStatus(request, dataMart),
      runs[0]
    );
  }

  async validateDataMart(request: McpDataMartSetupRequest): Promise<McpValidateDataMartResponse> {
    this.assertMutationActor(request);
    const dataMart = await this.getAccessibleDataMart(request);
    await this.assertEditAccess(request, dataMart.id);
    const setup = await this.mapSetup(request, dataMart);
    if (!dataMart.definition || !dataMart.definitionType) {
      return {
        dataMart: setup,
        valid: false,
        error: { code: 'DATA_MART_NO_DEFINITION', message: 'Data Mart has no definition' },
      };
    }
    try {
      const result = await this.validateDefinitionService.run(
        new ValidateDataMartDefinitionCommand(
          dataMart.id,
          request.projectId,
          request.userId,
          request.roles
        )
      );
      return {
        dataMart: setup,
        valid: result.valid,
        ...(result.valid
          ? {}
          : {
              error: {
                code: 'DATA_MART_VALIDATION_FAILED',
                message:
                  'Data Mart validation failed. Check its definition and credentials in the web app.',
              },
            }),
      };
    } catch (error) {
      if (error instanceof HttpException && [403, 404].includes(error.getStatus())) {
        throw this.safeException(error);
      }
      return {
        dataMart: setup,
        valid: false,
        error: {
          code: 'DATA_MART_VALIDATION_FAILED',
          message:
            'Data Mart validation failed. Check its definition and credentials in the web app.',
        },
      };
    }
  }

  async publishDataMart(request: McpDataMartSetupRequest): Promise<McpPublishDataMartResponse> {
    this.assertMutationActor(request);
    const current = await this.getAccessibleDataMart(request);
    await this.assertEditAccess(request, current.id);
    if (current.status !== DataMartStatus.DRAFT) {
      throw new BadRequestException('Data Mart is already published');
    }
    if (!current.definition || !current.definitionType) {
      throw new BadRequestException('Data Mart has no definition');
    }
    if (
      current.definitionType === DataMartDefinitionType.CONNECTOR &&
      (await this.credentialStatus(request, current)) !== 'configured'
    ) {
      throw new BadRequestException(
        'Complete storage and connector credential setup in the web app before publishing'
      );
    }
    // PublishDataMartService omits SQL validation; MCP must validate before invoking publish.
    const validation = await this.validateDataMart(request);
    if (!validation.valid) {
      throw new BadRequestException(validation.error?.message ?? 'Data Mart validation failed');
    }
    try {
      const dataMart = await this.publishDataMartService.run(
        new PublishDataMartCommand(
          request.dataMartId,
          request.projectId,
          request.userId,
          request.roles,
          request.userId
        )
      );
      return {
        ...(await this.mapSetup(request, dataMart)),
        connectorRunMayStart: dataMart.definitionType === DataMartDefinitionType.CONNECTOR,
      };
    } catch (error) {
      throw this.safeException(error);
    }
  }

  private assertActor(actor: McpDataMartActor): void {
    if (!actor.projectId || !actor.userId || !Array.isArray(actor.roles)) {
      throw new ForbiddenException('Authenticated project context is required');
    }
  }

  private assertMutationActor(actor: McpDataMartActor): void {
    this.assertActor(actor);
    if (!actor.roles.some(role => role === 'editor' || role === 'admin')) {
      throw new ForbiddenException('Editor or admin role is required for Data Mart setup');
    }
  }

  private parseTitle(title: unknown): string {
    const parsed = z.string().trim().min(1).max(255).safeParse(title);
    if (!parsed.success) throw new BadRequestException('Data Mart title must be 1-255 characters');
    return parsed.data;
  }

  private parseDescription(description: unknown): void {
    if (!z.string().optional().safeParse(description).success) {
      throw new BadRequestException('Invalid Data Mart description');
    }
  }

  private async getAccessibleDataMart(request: McpDataMartSetupRequest): Promise<DataMartDto> {
    try {
      return await this.getDataMartService.run(
        new GetDataMartCommand(request.dataMartId, request.projectId, request.userId, request.roles)
      );
    } catch (error) {
      throw this.safeException(error);
    }
  }

  private async assertEditAccess(actor: McpDataMartActor, dataMartId: string): Promise<void> {
    try {
      if (
        !(await this.accessDecisionService.canAccess(
          actor.userId,
          actor.roles,
          EntityType.DATA_MART,
          dataMartId,
          Action.EDIT,
          actor.projectId
        ))
      ) {
        throw new ForbiddenException('Data Mart setup access denied');
      }
    } catch (error) {
      throw this.safeException(error);
    }
  }

  private async prepareDefinitionSafely(
    actor: McpDataMartActor,
    input: McpDataMartDefinitionInput
  ): Promise<DataMartDefinition | undefined> {
    if (input.definition === undefined && input.definitionType === undefined) {
      if (input.sourceDataMartId || input.sourceConfigurationId) {
        throw new BadRequestException('Credential copy requires a connector definition');
      }
      return undefined;
    }
    if (!input.definitionType || input.definition === undefined) {
      throw new BadRequestException('definition_type and definition must be provided together');
    }
    const parsed = definitionSchemas[input.definitionType]?.safeParse(input.definition);
    if (!parsed?.success) {
      throw new BadRequestException('Definition does not match the selected definition_type');
    }
    if (input.definitionType !== DataMartDefinitionType.CONNECTOR) {
      if (input.sourceDataMartId || input.sourceConfigurationId) {
        throw new BadRequestException(
          'Credential copy is only available for connector definitions'
        );
      }
      return parsed.data;
    }
    if (input.sourceConfigurationId && !input.sourceDataMartId) {
      throw new BadRequestException('source_configuration_id requires source_data_mart_id');
    }
    const definition = parsed.data as ConnectorDefinition;
    try {
      const specification = await this.connectorService.getConnectorSpecification(
        definition.connector.source.name
      );
      const sensitiveFields = this.sensitiveFields(specification);
      for (const config of definition.connector.source.configuration) {
        this.assertSafeConfiguration(config, sensitiveFields);
        if (config._id !== undefined && (typeof config._id !== 'string' || !config._id)) {
          throw new BadRequestException('Invalid connector configuration ID');
        }
      }
      if (input.sourceDataMartId) {
        await this.attachOwnedCopyReferences(actor, input, definition, sensitiveFields);
      }
      return definition;
    } catch (error) {
      throw this.safeException(error);
    }
  }

  private sensitiveFields(
    specification: ConnectorSpecification,
    includeKnownNames = true
  ): Set<string> {
    const fields = new Set<string>(
      includeKnownNames ? ['AccessToken', 'RefreshToken', 'ClientSecret'] : []
    );
    type SpecificationField = {
      name?: string;
      attributes?: string[];
      oneOf?: Array<{ attributes?: string[]; items?: Record<string, SpecificationField> }>;
    };
    const collect = (item: SpecificationField, inheritedOAuth = false): void => {
      const oauth = inheritedOAuth || (item.attributes ?? []).includes('OAUTH_FLOW');
      if (
        item.name &&
        (item.attributes?.some(attribute => attribute === 'SECRET' || attribute === 'OAUTH') ||
          (oauth && !item.oneOf))
      ) {
        fields.add(item.name);
      }
      for (const option of item.oneOf ?? []) {
        const optionOAuth = oauth || (option.attributes ?? []).includes('OAUTH_FLOW');
        for (const nested of Object.values(option.items ?? {})) collect(nested, optionOAuth);
      }
    };
    specification.forEach(item => collect(item));
    return fields;
  }

  private assertSafeConfiguration(value: unknown, sensitiveFields: Set<string>): void {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(item => this.assertSafeConfiguration(item, sensitiveFields));
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (forbiddenConfigurationKeys.has(key)) {
        throw new BadRequestException('Raw credential pointers are not accepted by MCP setup');
      }
      if (key.startsWith('_') && key !== '_id' && !savedVariableMarkers.has(key)) {
        throw new BadRequestException('Unsupported internal connector configuration field');
      }
      if (savedVariableMarkers.has(key) && (typeof child !== 'string' || !child)) {
        throw new BadRequestException('Invalid saved variable reference');
      }
      if (
        (sensitiveFields.has(key) || secretLikeConfigurationKey.test(key)) &&
        child !== undefined &&
        child !== null &&
        child !== '' &&
        child !== SECRET_MASK
      ) {
        if (child && typeof child === 'object') {
          this.assertMaskedCredentialContainer(child);
        } else {
          throw new BadRequestException(
            'Enter credentials through the web app or reuse saved credential references'
          );
        }
      }
      this.assertSafeConfiguration(child, sensitiveFields);
    }
  }

  private assertMaskedCredentialContainer(value: unknown): void {
    if (value === undefined || value === null || value === '' || value === SECRET_MASK) return;
    if (Array.isArray(value)) {
      value.forEach(item => this.assertMaskedCredentialContainer(item));
      return;
    }
    if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        if (savedVariableMarkers.has(key) && typeof child === 'string' && child) continue;
        this.assertMaskedCredentialContainer(child);
      }
      return;
    }
    throw new BadRequestException(
      'Enter credentials through the web app or reuse saved credential references'
    );
  }

  private async attachOwnedCopyReferences(
    actor: McpDataMartActor,
    input: McpDataMartDefinitionInput,
    definition: ConnectorDefinition,
    sensitiveFields: Set<string>
  ): Promise<void> {
    const source = await this.getAccessibleDataMart({
      ...actor,
      dataMartId: input.sourceDataMartId!,
    });
    await this.assertEditAccess(actor, source.id);
    if (
      source.definitionType !== DataMartDefinitionType.CONNECTOR ||
      !source.definition ||
      !('connector' in source.definition) ||
      source.definition.connector.source.name !== definition.connector.source.name
    ) {
      throw new BadRequestException('Source Data Mart must use the same connector');
    }
    const sourceDefinition = source.definition as ConnectorDefinition;
    const sourceConfigs = sourceDefinition.connector.source.configuration;
    const sourceConfig = input.sourceConfigurationId
      ? sourceConfigs.find(config => config._id === input.sourceConfigurationId)
      : sourceConfigs.length === 1
        ? sourceConfigs[0]
        : undefined;
    if (!sourceConfig || typeof sourceConfig._id !== 'string') {
      throw new BadRequestException('Select a source configuration from the source Data Mart');
    }
    if (definition.connector.source.configuration.length !== 1) {
      throw new BadRequestException('Credential copy requires exactly one target configuration');
    }
    await this.assertOwnedCredentialReferences(
      actor,
      definition.connector.source.name,
      sourceConfig,
      source.id
    );
    const masked = await this.connectorSecretService.mask(sourceDefinition);
    const maskedSource = masked?.connector.source.configuration.find(
      config => config._id === sourceConfig._id
    );
    const target = definition.connector.source.configuration[0];
    this.copyCredentialPlaceholders(target, maskedSource ?? sourceConfig, sensitiveFields);
    target._id ??= randomUUID();
    target._copiedFrom = { configId: sourceConfig._id };
  }

  private async assertOwnedCredentialReferences(
    actor: McpDataMartActor,
    connectorName: string,
    value: unknown,
    sourceDataMartId: string
  ): Promise<void> {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      await Promise.all(
        value.map(item =>
          this.assertOwnedCredentialReferences(actor, connectorName, item, sourceDataMartId)
        )
      );
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (key === '_secrets_id' || key === '_source_credential_id') {
        const credential =
          typeof child === 'string'
            ? await this.connectorCredentialsService.getCredentialsById(child)
            : undefined;
        if (
          !credential ||
          credential.projectId !== actor.projectId ||
          credential.connectorName !== connectorName ||
          (key === '_secrets_id' && credential.dataMartId !== sourceDataMartId)
        ) {
          throw new ForbiddenException(
            'Source connector credentials are not available in this project'
          );
        }
      } else {
        await this.assertOwnedCredentialReferences(actor, connectorName, child, sourceDataMartId);
      }
    }
  }

  private copyCredentialPlaceholders(
    target: Record<string, unknown>,
    source: Record<string, unknown>,
    sensitiveFields: Set<string>
  ): void {
    for (const [key, child] of Object.entries(source)) {
      if (key === '_source_credential_id') {
        target[key] = child;
      } else if (sensitiveFields.has(key) || secretLikeConfigurationKey.test(key)) {
        target[key] = SECRET_MASK;
      } else if (
        !key.startsWith('_') &&
        child &&
        typeof child === 'object' &&
        !Array.isArray(child)
      ) {
        const nested: Record<string, unknown> = {};
        this.copyCredentialPlaceholders(nested, child as Record<string, unknown>, sensitiveFields);
        if (Object.keys(nested).length > 0) {
          const current = target[key];
          const object =
            current && typeof current === 'object' && !Array.isArray(current)
              ? (current as Record<string, unknown>)
              : {};
          target[key] = object;
          this.copyCredentialPlaceholders(
            object,
            child as Record<string, unknown>,
            sensitiveFields
          );
        }
      }
    }
  }

  private async preserveOwnedOAuthReferences(
    actor: McpDataMartActor,
    current: DataMartDto,
    definition: ConnectorDefinition
  ): Promise<void> {
    const previous = (current.definition as ConnectorDefinition).connector.source.configuration;
    for (const target of definition.connector.source.configuration) {
      const source = previous.find(
        config => typeof target._id === 'string' && config._id === target._id
      );
      if (!source) continue;
      await this.assertOwnedCredentialReferences(
        actor,
        definition.connector.source.name,
        source,
        current.id
      );
      // Only preserve pointers on existing matching paths: changing an auth option must not
      // silently keep the credentials from the old option.
      const preserve = (
        incoming: Record<string, unknown>,
        saved: Record<string, unknown>
      ): void => {
        if (typeof saved._source_credential_id === 'string') {
          incoming._source_credential_id = saved._source_credential_id;
        }
        for (const [key, child] of Object.entries(incoming)) {
          const old = saved[key];
          if (
            child &&
            typeof child === 'object' &&
            !Array.isArray(child) &&
            old &&
            typeof old === 'object' &&
            !Array.isArray(old)
          ) {
            preserve(child as Record<string, unknown>, old as Record<string, unknown>);
          }
        }
      };
      preserve(target, source);
    }
  }

  private saveDefinition(
    request: McpDataMartActor & McpDataMartDefinitionInput,
    dataMartId: string,
    definition: DataMartDefinition
  ): Promise<DataMartDto> {
    return this.updateDefinitionService.run(
      new UpdateDataMartDefinitionCommand(
        dataMartId,
        request.projectId,
        request.definitionType!,
        definition,
        request.sourceDataMartId,
        request.sourceConfigurationId,
        request.userId,
        request.roles
      )
    );
  }

  private async mapSetup(
    actor: McpDataMartActor,
    dataMart: DataMartDto
  ): Promise<McpDataMartSetup> {
    return this.mapper.toSetupDto(
      dataMart,
      actor.projectId,
      await this.credentialStatus(actor, dataMart)
    );
  }

  private async credentialStatus(
    actor: McpDataMartActor,
    dataMart: DataMartDto
  ): Promise<McpDataMartCredentialStatus> {
    if (!dataMart.storage.credentialId || !dataMart.storage.config) return 'missing';
    try {
      const warehouseCredential = await this.storageCredentialService.getById(
        dataMart.storage.credentialId
      );
      if (
        !warehouseCredential ||
        warehouseCredential.projectId !== actor.projectId ||
        !storageCredentialTypes[dataMart.storage.type]?.includes(warehouseCredential.type)
      )
        return 'missing';
      if (warehouseCredential.type === StorageCredentialType.GOOGLE_OAUTH) {
        // Google access-token expiry is refreshable; only missing refresh credentials require setup.
        if (
          !('refresh_token' in warehouseCredential.credentials) ||
          !warehouseCredential.credentials.refresh_token
        )
          return 'expired';
      } else if (
        warehouseCredential.expiresAt &&
        warehouseCredential.expiresAt.getTime() <= Date.now()
      ) {
        return 'expired';
      }
      if (dataMart.definitionType !== DataMartDefinitionType.CONNECTOR) return 'configured';
      if (!dataMart.definition || !('connector' in dataMart.definition)) return 'missing';
      const statuses: McpDataMartCredentialStatus[] = [];
      const inspect = async (value: unknown): Promise<void> => {
        if (!value || typeof value !== 'object') return;
        if (Array.isArray(value)) {
          await Promise.all(value.map(inspect));
          return;
        }
        for (const [key, child] of Object.entries(value)) {
          if (key === '_secrets_id' || key === '_source_credential_id') {
            const credential =
              typeof child === 'string'
                ? await this.connectorCredentialsService.getCredentialsById(child)
                : undefined;
            if (
              !credential ||
              credential.projectId !== actor.projectId ||
              (key === '_secrets_id' && credential.dataMartId !== dataMart.id) ||
              credential.connectorName !==
                (dataMart.definition as ConnectorDefinition).connector.source.name
            ) {
              statuses.push('missing');
            } else {
              statuses.push(
                credential.expiresAt && credential.expiresAt.getTime() <= Date.now()
                  ? 'expired'
                  : 'configured'
              );
            }
          } else if (savedVariableMarkers.has(key)) {
            statuses.push('unknown');
          } else {
            await inspect(child);
          }
        }
      };
      const specification = await this.connectorService.getConnectorSpecification(
        dataMart.definition.connector.source.name
      );
      const sensitive = this.sensitiveFields(specification, false);
      const configuration = dataMart.definition.connector.source.configuration;
      for (const config of configuration) {
        const count = statuses.length;
        await inspect(config);
        if (statuses.length === count) {
          // Connectors with no credential-bearing fields can legitimately be public sources.
          statuses.push(
            specification.length > 0 && sensitive.size === 0 ? 'configured' : 'missing'
          );
        }
      }
      if (statuses.includes('missing')) return 'missing';
      if (statuses.includes('expired')) return 'expired';
      if (statuses.includes('unknown') || statuses.length === 0) return 'unknown';
      return 'configured';
    } catch {
      return 'unknown';
    }
  }

  private async partialResult(
    actor: McpDataMartActor,
    fallback: DataMartDto
  ): Promise<McpDataMartSetup> {
    let current = fallback;
    try {
      current = await this.getAccessibleDataMart({ ...actor, dataMartId: fallback.id });
    } catch {
      // Keep the already returned DTO when the follow-up read is temporarily unavailable.
    }
    return {
      ...(await this.mapSetup(actor, current)),
      setupRequired: true,
      setupError: {
        code: 'DATA_MART_SETUP_INCOMPLETE',
        message:
          'Data Mart exists but setup did not finish. Continue using this data_mart_id; inspect setup in the web app before retrying.',
      },
    };
  }

  private safeException(error: unknown): HttpException {
    const normalized = castError(error);
    const message =
      'Data Mart setup failed. Check the definition, credential references and project access in the web app.';
    if (normalized instanceof HttpException) {
      if (normalized.getStatus() === 403)
        return new ForbiddenException('Data Mart setup access denied');
      if (normalized.getStatus() === 404)
        return new NotFoundException('Data Mart or setup resource not found');
      if (normalized.getStatus() === 400) return new BadRequestException(message);
    }
    if (normalized instanceof BusinessViolationException) return new BadRequestException(message);
    return new HttpException(
      message,
      normalized instanceof HttpException ? normalized.getStatus() : 500
    );
  }
}
