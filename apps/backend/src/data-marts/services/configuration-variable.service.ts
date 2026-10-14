import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { ConfigurationVariable } from '../entities/configuration-variable.entity';
import { ConfigurationVariableKind } from '../enums/configuration-variable-kind.enum';
import { DataMartDefinitionType } from '../enums/data-mart-definition-type.enum';
import { ConnectorSourceCredentialsService } from './connector/connector-source-credentials.service';
import { DataMartService } from './data-mart.service';
import { AccessDecisionService, Action, EntityType } from './access-decision';
import { isUniqueConstraintViolation } from '../../common/typeorm/query-error.utils';

type VariableValue = string | number | boolean | string[];
type CredentialIdentity = {
  id?: string;
  name?: string;
  email?: string;
  picture?: string;
};

export interface ConfigurationVariableInput {
  name: string;
  kind: ConfigurationVariableKind;
  value?: VariableValue;
  description?: string;
  credentialId?: string;
  fieldPath?: string;
}

@Injectable()
export class ConfigurationVariableService {
  constructor(
    @InjectRepository(ConfigurationVariable)
    private readonly repository: Repository<ConfigurationVariable>,
    private readonly connectorCredentials: ConnectorSourceCredentialsService,
    private readonly dataMartService: DataMartService,
    private readonly accessDecisionService: AccessDecisionService
  ) {}

  async list(projectId: string): Promise<ConfigurationVariable[]> {
    const items = await this.repository.find({
      where: { deletedAt: IsNull() },
      order: { name: 'ASC' },
    });
    const byName = new Map<string, ConfigurationVariable>();
    for (const item of items) {
      const existing = byName.get(item.name);
      if (!existing || item.projectId === projectId) {
        byName.set(item.name, item);
      }
    }
    return Array.from(byName.values());
  }

  async listCredentialCandidates(projectId: string, userId: string, roles: string[]) {
    const credentials = await this.connectorCredentials.getCredentialsByProjectId(projectId);
    const visible = await Promise.all(
      credentials.map(async credential => {
        if (!credential.dataMartId) return credential;
        const canUse = await this.accessDecisionService.canAccess(
          userId,
          roles,
          EntityType.DATA_MART,
          credential.dataMartId,
          Action.EDIT,
          credential.projectId ?? projectId
        );
        return canUse ? credential : null;
      })
    );
    return visible
      .filter((credential): credential is NonNullable<typeof credential> => credential !== null)
      .map(credential => ({
        id: credential.id,
        connectorName: credential.connectorName,
        kind: (credential.kind === 'secret' || Boolean(credential.dataMartId && credential.configId)
          ? ConfigurationVariableKind.SECRET_REFERENCE
          : ConfigurationVariableKind.CREDENTIAL_REFERENCE) as
          | ConfigurationVariableKind.SECRET_REFERENCE
          | ConfigurationVariableKind.CREDENTIAL_REFERENCE,
        // Provider responses can contain more than display metadata. Keep the
        // candidate endpoint deliberately narrow so no raw identity payload is
        // ever sent to the browser.
        identity: this.toSafeIdentity(credential.user),
        expiresAt: credential.expiresAt ?? null,
        dataMartId: credential.dataMartId ?? null,
        configId: credential.configId ?? null,
        createdAt: credential.createdAt,
      }));
  }

  async create(
    projectId: string,
    createdById: string,
    input: ConfigurationVariableInput,
    roles: string[] = []
  ) {
    this.validateInput(input);
    const duplicate = await this.repository.findOne({
      where: { projectId, name: input.name.trim(), deletedAt: IsNull() },
    });
    if (duplicate) {
      throw new ConflictException(`Variable named "${input.name.trim()}" already exists`);
    }

    const credential = await this.resolveCredential(projectId, createdById, input, roles);
    const createdReusableSecretId =
      input.kind === ConfigurationVariableKind.SECRET_REFERENCE ? credential?.id : undefined;
    const entity = this.repository.create({
      id: randomUUID(),
      projectId,
      createdById,
      name: input.name.trim(),
      kind: input.kind,
      value: input.kind === ConfigurationVariableKind.VALUE ? (input.value ?? null) : null,
      valueType:
        input.kind === ConfigurationVariableKind.VALUE ? this.getValueType(input.value) : null,
      connectorName: credential?.connectorName ?? null,
      credentialId: credential?.id ?? null,
      sourceDataMartId: credential?.dataMartId ?? null,
      sourceConfigId: credential?.configId ?? null,
      fieldPath: input.fieldPath?.trim() || null,
      description: input.description?.trim() || null,
    });
    try {
      return await this.repository.save(entity);
    } catch (error) {
      if (createdReusableSecretId) {
        try {
          await this.connectorCredentials.deleteReusableSecret(projectId, createdReusableSecretId);
        } catch {
          // Preserve the original persistence error. A later cleanup pass can
          // reclaim the copied credential if this best-effort delete fails.
        }
      }
      // The database unique index closes the concurrent-create race that a
      // preflight lookup cannot prevent.
      if (isUniqueConstraintViolation(error)) {
        throw new ConflictException(`Variable named "${entity.name}" already exists`);
      }
      throw error;
    }
  }

  async update(projectId: string, id: string, input: Partial<ConfigurationVariableInput>) {
    const entity = await this.getOwned(projectId, id);
    const nextKind = input.kind ?? entity.kind;
    if (input.kind && input.kind !== entity.kind) {
      throw new BadRequestException('Variable kind cannot be changed after creation');
    }
    if (input.credentialId && input.credentialId !== entity.credentialId) {
      throw new BadRequestException(
        'Credential reference cannot be changed; create a new variable'
      );
    }
    if (nextKind === ConfigurationVariableKind.VALUE && input.value !== undefined) {
      this.validateValue(input.value);
      entity.value = input.value;
      entity.valueType = this.getValueType(input.value);
    }
    if (input.name !== undefined && input.name.trim() !== entity.name) {
      this.validateName(input.name);
      const duplicate = await this.repository.findOne({
        where: { projectId, name: input.name.trim(), deletedAt: IsNull() },
      });
      if (duplicate && duplicate.id !== entity.id) {
        throw new ConflictException(`Variable named "${input.name.trim()}" already exists`);
      }
      entity.name = input.name.trim();
    }
    if (input.description !== undefined) entity.description = input.description.trim() || null;
    if (input.fieldPath !== undefined) {
      this.validateFieldPath(input.fieldPath);
      entity.fieldPath = input.fieldPath.trim() || null;
    }
    try {
      return await this.repository.save(entity);
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new ConflictException(`Variable named "${entity.name}" already exists`);
      }
      throw error;
    }
  }

  async remove(projectId: string, id: string): Promise<void> {
    const entity = await this.getOwned(projectId, id);
    const usageCount = await this.countUsage(projectId, id);
    if (usageCount > 0) {
      throw new ConflictException(
        `Variable is still used by ${usageCount} Data Mart configuration(s)`
      );
    }
    // Variables hold metadata/references only. Hard-delete the row after the
    // usage check so a project can safely reuse the same name and the DB
    // unique index remains the final race-condition guard.
    await this.repository.delete(entity.id);

    // A secret variable owns the project-scoped copy created at variable
    // creation time. Reclaim it when no other variable points at the same
    // credential, otherwise deleting a variable would leave an orphaned
    // credential payload indefinitely.
    if (entity.kind === ConfigurationVariableKind.SECRET_REFERENCE && entity.credentialId) {
      const otherReferences = await this.repository.count({
        where: {
          credentialId: entity.credentialId,
          deletedAt: IsNull(),
        },
      });
      if (otherReferences === 0) {
        await this.connectorCredentials.deleteReusableSecret(
          entity.projectId ?? projectId,
          entity.credentialId
        );
      }
    }
  }

  async getOwned(_projectId: string, id: string): Promise<ConfigurationVariable> {
    const entity = await this.repository.findOne({ where: { id, deletedAt: IsNull() } });
    if (!entity) throw new NotFoundException('Configuration variable not found');
    return entity;
  }

  async resolve(projectId: string, id: string): Promise<ConfigurationVariable> {
    return this.getOwned(projectId, id);
  }

  async countUsage(projectId: string, id: string): Promise<number> {
    const dataMarts = await this.dataMartService.findByProjectIdAndDefinitionType(
      projectId,
      DataMartDefinitionType.CONNECTOR
    );
    let count = 0;
    for (const dataMart of dataMarts) {
      if (this.containsVariableId(dataMart.definition, id)) count += 1;
    }
    return count;
  }

  private async resolveCredential(
    projectId: string,
    createdById: string,
    input: ConfigurationVariableInput,
    roles: string[]
  ) {
    if (input.kind === ConfigurationVariableKind.VALUE) {
      if (input.credentialId)
        throw new BadRequestException('VALUE variables cannot reference credentials');
      this.validateValue(input.value);
      return undefined;
    }
    if (!input.credentialId) {
      throw new BadRequestException('Credential reference requires credentialId');
    }
    const credential = await this.connectorCredentials.getCredentialsById(input.credentialId);
    if (!credential) {
      throw new BadRequestException('Credential does not belong to this project');
    }
    const credentialKind = credential.kind ?? (credential.dataMartId ? 'secret' : 'oauth');
    const isSecretReference = credentialKind === 'secret';
    if (isSecretReference && credential.dataMartId) {
      const canUse = await this.accessDecisionService.canAccess(
        createdById,
        roles,
        EntityType.DATA_MART,
        credential.dataMartId,
        Action.EDIT,
        credential.projectId ?? projectId
      );
      if (!canUse) {
        throw new BadRequestException('Credential is not available for reuse');
      }
    }
    if (input.kind === ConfigurationVariableKind.CREDENTIAL_REFERENCE && credential.dataMartId) {
      throw new BadRequestException('OAuth credential must be project-scoped');
    }
    if (
      (input.kind === ConfigurationVariableKind.SECRET_REFERENCE && !isSecretReference) ||
      (input.kind === ConfigurationVariableKind.CREDENTIAL_REFERENCE && isSecretReference)
    ) {
      throw new BadRequestException(
        'Credential reference kind does not match the selected credential'
      );
    }
    if (input.kind === ConfigurationVariableKind.SECRET_REFERENCE) {
      return this.connectorCredentials.createReusableSecrets(
        projectId,
        credential.connectorName,
        credential.credentials,
        createdById
      );
    }
    return credential;
  }

  private validateInput(input: ConfigurationVariableInput): void {
    this.validateName(input.name);
    if (input.description && input.description.length > 500) {
      throw new BadRequestException('Variable description is too long');
    }
    if (input.fieldPath) this.validateFieldPath(input.fieldPath);
  }

  private validateFieldPath(fieldPath: string): void {
    if (!/^[A-Za-z][A-Za-z0-9_.-]*$/.test(fieldPath.trim())) {
      throw new BadRequestException('Variable fieldPath contains unsupported characters');
    }
  }

  private validateName(name: string): void {
    if (!/^[A-Za-z][A-Za-z0-9_.-]{0,99}$/.test(name.trim())) {
      throw new BadRequestException(
        'Variable name must start with a letter and contain only letters, numbers, _, ., or -'
      );
    }
  }

  private validateValue(value: unknown): asserts value is VariableValue {
    if (
      !(
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        (Array.isArray(value) && value.every(item => typeof item === 'string'))
      )
    ) {
      throw new BadRequestException(
        'Variable value must be a string, number, boolean, or string array'
      );
    }
    if (typeof value === 'string' && value.length > 4096) {
      throw new BadRequestException('Variable value is too long');
    }
    const serialized = JSON.stringify(value);
    if (serialized.length > 8192) throw new BadRequestException('Variable value is too large');
  }

  private getValueType(value: VariableValue | undefined): ConfigurationVariable['valueType'] {
    if (Array.isArray(value)) return 'string[]';
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    return null;
  }

  private toSafeIdentity(identity: CredentialIdentity | undefined): CredentialIdentity | null {
    if (!identity || typeof identity !== 'object') return null;
    const safe: CredentialIdentity = {};
    for (const key of ['id', 'name', 'email', 'picture'] as const) {
      const value = identity[key];
      if (typeof value === 'string' && value.length <= 512) safe[key] = value;
    }
    return Object.keys(safe).length > 0 ? safe : null;
  }

  private containsVariableId(value: unknown, id: string): boolean {
    if (!value || typeof value !== 'object') return false;
    if (Array.isArray(value)) return value.some(item => this.containsVariableId(item, id));
    return Object.entries(value as Record<string, unknown>).some(([key, child]) => {
      if (['_variable_id', '_secrets_variable_id', '_credential_variable_id'].includes(key)) {
        return child === id;
      }
      return this.containsVariableId(child, id);
    });
  }
}
