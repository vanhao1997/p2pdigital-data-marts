import { BadRequestException, ForbiddenException, HttpException, Injectable } from '@nestjs/common';
import { castError } from '@owox/internal-helpers';
import { z } from 'zod';
import { DataStorageType } from '../data-storage-types/enums/data-storage-type.enum';
import { DataStorageDto } from '../dto/domain/data-storage.dto';
import { CreateDataStorageCommand } from '../dto/domain/create-data-storage.command';
import { GetDataStorageCommand } from '../dto/domain/get-data-storage.command';
import { ListDataStoragesCommand } from '../dto/domain/list-data-storages.command';
import { UpdateDataStorageCommand } from '../dto/domain/update-data-storage.command';
import { ValidateDataStorageAccessCommand } from '../dto/domain/validate-data-storage-access.command';
import { StorageCredentialType } from '../enums/storage-credential-type.enum';
import { McpSetupStoragesMapper } from '../mappers/mcp-setup-storages.mapper';
import { AccessDecisionService, Action, EntityType } from '../services/access-decision';
import { DataStorageCredentialService } from '../services/data-storage-credential.service';
import { AvailableConnectorService } from '../use-cases/connector/available-connector.service';
import { FieldsConnectorService } from '../use-cases/connector/fields-connector.service';
import { SpecificationConnectorService } from '../use-cases/connector/specification-connector.service';
import { CreateDataStorageService } from '../use-cases/create-data-storage.service';
import { GetDataStorageService } from '../use-cases/get-data-storage.service';
import { ListDataStoragesService } from '../use-cases/list-data-storages.service';
import { UpdateDataStorageService } from '../use-cases/update-data-storage.service';
import { ValidateDataStorageAccessService } from '../use-cases/validate-data-storage-access.service';
import { parseMcpStorageConfig } from './mcp-storage-config.schema';
import type {
  McpConfigureDataStorageRequest,
  McpConnectorRequest,
  McpCreateDataStorageRequest,
  McpDataStorageSetup,
  McpGetConnectorFieldsResult,
  McpGetConnectorSpecificationResult,
  McpListConnectorsResult,
  McpListDataStoragesResult,
  McpSetupStoragesFacade,
  McpStorageCredentialStatus,
  McpStorageSetupContext,
  McpValidateDataStorageRequest,
  McpValidateDataStorageResult,
} from './mcp-setup-storages.facade';

const titleSchema = z.string().trim().min(1).max(255);
const connectorNameSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z][A-Za-z0-9_]*$/);
const referenceSchema = z.string().min(1).max(255);
const credentialTypes: Record<DataStorageType, StorageCredentialType[]> = {
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
export class McpSetupStoragesFacadeImpl implements McpSetupStoragesFacade {
  constructor(
    private readonly listDataStoragesService: ListDataStoragesService,
    private readonly getDataStorageService: GetDataStorageService,
    private readonly createDataStorageService: CreateDataStorageService,
    private readonly updateDataStorageService: UpdateDataStorageService,
    private readonly validateDataStorageAccessService: ValidateDataStorageAccessService,
    private readonly availableConnectorService: AvailableConnectorService,
    private readonly specificationConnectorService: SpecificationConnectorService,
    private readonly fieldsConnectorService: FieldsConnectorService,
    private readonly credentialService: DataStorageCredentialService,
    private readonly accessDecisionService: AccessDecisionService,
    private readonly mapper: McpSetupStoragesMapper
  ) {}

  async listDataStorages(request: McpStorageSetupContext): Promise<McpListDataStoragesResult> {
    return this.safely(async () => {
      this.assertContext(request);
      const storages = await this.listDataStoragesService.run(
        new ListDataStoragesCommand(request.projectId, request.userId, request.roles)
      );
      return { dataStorages: await Promise.all(storages.map(storage => this.toStorage(storage))) };
    });
  }

  async listConnectors(request: McpStorageSetupContext): Promise<McpListConnectorsResult> {
    return this.safely(async () => {
      this.assertContext(request);
      const connectors = await this.availableConnectorService.run();
      return { connectors: connectors.map(connector => this.mapper.toConnector(connector)) };
    });
  }

  async getConnectorSpecification(
    request: McpConnectorRequest
  ): Promise<McpGetConnectorSpecificationResult> {
    return this.safely(async () => {
      this.assertContext(request);
      const connectorName = this.parse(connectorNameSchema, request.connectorName);
      const specification = await this.specificationConnectorService.run(connectorName);
      return { connectorName, specification: this.mapper.toSpecification(specification) };
    });
  }

  async getConnectorFields(request: McpConnectorRequest): Promise<McpGetConnectorFieldsResult> {
    return this.safely(async () => {
      this.assertContext(request);
      const connectorName = this.parse(connectorNameSchema, request.connectorName);
      const fields = await this.fieldsConnectorService.run(connectorName);
      return { connectorName, fields: this.mapper.toFields(fields) };
    });
  }

  async createDataStorage(request: McpCreateDataStorageRequest): Promise<McpDataStorageSetup> {
    return this.safely(async () => {
      this.assertWriteRole(request);
      const storageType = this.parse(z.nativeEnum(DataStorageType), request.storageType);
      if (storageType === DataStorageType.LEGACY_GOOGLE_BIGQUERY) {
        throw new BadRequestException('Legacy storage cannot be created through MCP.');
      }
      const title = this.parse(titleSchema, request.title);
      const created = await this.createDataStorageService.run(
        new CreateDataStorageCommand(
          request.projectId,
          storageType,
          request.userId,
          undefined,
          title
        )
      );
      return this.toStorage(created);
    });
  }

  async configureDataStorage(
    request: McpConfigureDataStorageRequest
  ): Promise<McpDataStorageSetup> {
    return this.safely(async () => {
      this.assertWriteRole(request);
      const storageId = this.parse(referenceSchema, request.storageId);
      const title = this.parse(titleSchema, request.title);
      const target = await this.getStorage(request, storageId);
      await this.assertAccess(request, storageId, Action.EDIT);
      const config = parseMcpStorageConfig(target.type, request.config);
      if (request.credentialId !== undefined && request.sourceStorageId !== undefined) {
        throw new BadRequestException('Only one credential reference can be provided.');
      }
      if (request.credentialId === undefined && request.sourceStorageId === undefined) {
        throw new BadRequestException('A credential reference is required.');
      }

      let sourceStorageId = request.sourceStorageId;
      if (request.credentialId !== undefined) {
        const credentialId = this.parse(referenceSchema, request.credentialId);
        const credential = await this.credentialService.getById(credentialId);
        if (
          !credential ||
          credential.projectId !== request.projectId ||
          !credentialTypes[target.type]?.includes(credential.type)
        ) {
          throw new BadRequestException('Credential reference is not available in this project.');
        }
        if (target.credentialId !== credentialId) {
          const storages = await this.listDataStoragesService.run(
            new ListDataStoragesCommand(request.projectId, request.userId, request.roles)
          );
          const source = storages.find(storage => storage.credentialId === credentialId);
          if (!source) {
            throw new BadRequestException('Complete credential setup in the web application.');
          }
          sourceStorageId = source.id;
        }
      }
      if (sourceStorageId !== undefined) {
        sourceStorageId = this.parse(referenceSchema, sourceStorageId);
        if (sourceStorageId === storageId) {
          throw new BadRequestException('A storage cannot copy its own credentials.');
        }
        const source = await this.getStorage(request, sourceStorageId);
        await this.assertAccess(request, sourceStorageId, Action.COPY_CREDENTIALS);
        if (source.type !== target.type || !source.credentialId) {
          throw new BadRequestException('Source storage must have credentials of the same type.');
        }
        const credential = await this.credentialService.getById(source.credentialId);
        if (
          !credential ||
          credential.projectId !== request.projectId ||
          !credentialTypes[target.type]?.includes(credential.type)
        ) {
          throw new BadRequestException('Credential reference is not available in this project.');
        }
      } else if (!target.credentialId) {
        throw new BadRequestException('Complete credential setup in the web application.');
      } else {
        const credential = await this.credentialService.getById(target.credentialId);
        if (
          !credential ||
          credential.projectId !== request.projectId ||
          !credentialTypes[target.type]?.includes(credential.type)
        ) {
          throw new BadRequestException('Complete credential setup in the web application.');
        }
      }

      const configured = await this.updateDataStorageService.run(
        new UpdateDataStorageCommand(
          storageId,
          request.projectId,
          config,
          title,
          undefined,
          undefined,
          sourceStorageId,
          undefined,
          request.userId,
          request.roles
        )
      );
      return this.toStorage(configured);
    });
  }

  async validateDataStorage(
    request: McpValidateDataStorageRequest
  ): Promise<McpValidateDataStorageResult> {
    return this.safely(async () => {
      this.assertWriteRole(request);
      const storageId = this.parse(referenceSchema, request.storageId);
      const storage = await this.getStorage(request, storageId);
      await this.assertAccess(request, storageId, Action.USE);
      const result = await this.validateDataStorageAccessService.run(
        new ValidateDataStorageAccessCommand(
          storageId,
          request.projectId,
          request.userId,
          request.roles
        )
      );
      return this.mapper.toValidation(await this.toStorage(storage), result);
    });
  }

  private getStorage(request: McpStorageSetupContext, storageId: string): Promise<DataStorageDto> {
    return this.getDataStorageService.run(
      new GetDataStorageCommand(storageId, request.projectId, request.userId, request.roles)
    );
  }

  private async toStorage(storage: DataStorageDto): Promise<McpDataStorageSetup> {
    return this.mapper.toStorage(storage, await this.getCredentialStatus(storage));
  }

  private async getCredentialStatus(storage: DataStorageDto): Promise<McpStorageCredentialStatus> {
    if (!storage.credentialId) return 'missing';
    const credential = await this.credentialService.getById(storage.credentialId);
    if (
      !credential ||
      credential.projectId !== storage.projectId ||
      !credentialTypes[storage.type]?.includes(credential.type)
    ) {
      return 'unknown';
    }
    // OAuth access-token expiry is refreshable; it does not imply an expired connection.
    if (credential.type === StorageCredentialType.GOOGLE_OAUTH) {
      if (!('refresh_token' in credential.credentials) || !credential.credentials.refresh_token) {
        return 'expired';
      }
    } else if (credential.expiresAt && credential.expiresAt.getTime() <= Date.now()) {
      return 'expired';
    }
    return 'configured';
  }

  private assertContext(request: McpStorageSetupContext): void {
    if (!request.projectId || !request.userId || !Array.isArray(request.roles)) {
      throw new ForbiddenException('Authenticated project context is required.');
    }
  }

  private assertWriteRole(request: McpStorageSetupContext): void {
    this.assertContext(request);
    if (!request.roles.some(role => role === 'editor' || role === 'admin')) {
      throw new ForbiddenException('Editor or admin role is required.');
    }
  }

  private async assertAccess(
    request: McpStorageSetupContext,
    storageId: string,
    action: Action
  ): Promise<void> {
    if (
      !(await this.accessDecisionService.canAccess(
        request.userId,
        request.roles,
        EntityType.STORAGE,
        storageId,
        action,
        request.projectId
      ))
    ) {
      throw new ForbiddenException('Storage permission is required.');
    }
  }

  private parse<T>(schema: z.ZodType<T>, input: unknown): T {
    const parsed = schema.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Invalid MCP setup input.');
    return parsed.data;
  }

  private async safely<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const normalized = castError(error);
      const status = normalized instanceof HttpException ? normalized.getStatus() : 500;
      const messages: Record<number, string> = {
        400: 'Invalid setup input or credential reference. Complete credential setup in the web application.',
        403: 'You do not have permission for this storage setup operation.',
        404: 'Storage or connector was not found in the current project.',
      };
      throw new HttpException(
        messages[status] ?? 'Storage setup operation failed. Check setup in the web application.',
        status
      );
    }
  }
}
