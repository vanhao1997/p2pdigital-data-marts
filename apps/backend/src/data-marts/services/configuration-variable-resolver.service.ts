import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigurationVariable } from '../entities/configuration-variable.entity';
import { ConfigurationVariableKind } from '../enums/configuration-variable-kind.enum';
import { ConfigurationVariableService } from './configuration-variable.service';
import { ConnectorSourceCredentialsService } from './connector/connector-source-credentials.service';

const VALUE_MARKER = '_variable_id';
const SECRET_MARKER = '_secrets_variable_id';
const CREDENTIAL_MARKER = '_credential_variable_id';

/**
 * Resolves saved variable markers into the legacy connector contract. The
 * connector executor and preview both call this service before credential
 * injection, so they cannot drift apart.
 */
@Injectable()
export class ConfigurationVariableResolverService {
  private readonly logger = new Logger(ConfigurationVariableResolverService.name);

  constructor(
    private readonly variables: ConfigurationVariableService,
    private readonly credentials: ConnectorSourceCredentialsService
  ) {}

  async resolveConnectorConfig(
    config: Record<string, unknown>,
    projectId: string,
    connectorName: string
  ): Promise<Record<string, unknown>> {
    const cache = new Map<string, ConfigurationVariable>();
    return (await this.resolveValue(config, projectId, connectorName, cache, '')) as Record<
      string,
      unknown
    >;
  }

  /**
   * Resolves markers while saving a Data Mart. Reusable secret references are
   * expanded in memory so ConnectorSecretService can persist a new
   * Data-Mart-owned record; the shared project credential is never mutated.
   */
  async resolveConnectorConfigForSave(
    config: Record<string, unknown>,
    projectId: string,
    connectorName: string
  ): Promise<Record<string, unknown>> {
    return (await this.resolveValueForSave(
      config,
      projectId,
      connectorName,
      new Map(),
      ''
    )) as Record<string, unknown>;
  }

  private async resolveValue(
    value: unknown,
    projectId: string,
    connectorName: string,
    cache: Map<string, ConfigurationVariable>,
    path: string
  ): Promise<unknown> {
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) {
      return Promise.all(
        value.map((item, index) =>
          this.resolveValue(item, projectId, connectorName, cache, `${path}[${index}]`)
        )
      );
    }

    const object = value as Record<string, unknown>;
    if (typeof object[SECRET_MARKER] === 'string') {
      this.assertStandaloneMarker(object, SECRET_MARKER, path);
      const variable = await this.getVariable(projectId, object[SECRET_MARKER] as string, cache);
      const credential = await this.getReferenceCredential(
        variable,
        projectId,
        connectorName,
        ConfigurationVariableKind.SECRET_REFERENCE
      );
      const { [SECRET_MARKER]: _marker, ...rest } = object;
      // Runtime keeps the opaque reference so the standard injector can load
      // the shared secret without returning its payload from this resolver.
      return { ...rest, _secrets_id: credential.id };
    }
    if (typeof object[CREDENTIAL_MARKER] === 'string') {
      this.assertStandaloneMarker(object, CREDENTIAL_MARKER, path);
      const variable = await this.getVariable(
        projectId,
        object[CREDENTIAL_MARKER] as string,
        cache
      );
      const credential = await this.getReferenceCredential(
        variable,
        projectId,
        connectorName,
        ConfigurationVariableKind.CREDENTIAL_REFERENCE
      );
      const { [CREDENTIAL_MARKER]: _marker, ...rest } = object;
      return { ...rest, _source_credential_id: credential.id };
    }
    const markerEntries = [VALUE_MARKER, SECRET_MARKER, CREDENTIAL_MARKER].filter(
      key => key in object
    );
    if (markerEntries.length > 0) {
      if (markerEntries.length !== 1 || Object.keys(object).length !== 1) {
        throw new BadRequestException(
          `Invalid saved variable marker at ${path || 'connector configuration'}`
        );
      }
      const marker = markerEntries[0];
      const id = object[marker];
      if (typeof id !== 'string' || !id) {
        throw new BadRequestException(
          `Invalid saved variable id at ${path || 'connector configuration'}`
        );
      }
      const variable = await this.getVariable(projectId, id, cache);
      if (variable.connectorName && variable.connectorName !== connectorName) {
        throw new BadRequestException('Saved variable belongs to a different connector');
      }

      if (marker === VALUE_MARKER) {
        if (variable.kind !== ConfigurationVariableKind.VALUE) {
          throw new BadRequestException('Only value variables can be used as field values');
        }
        return variable.value;
      }
      if (marker === SECRET_MARKER) {
        if (
          variable.kind !== ConfigurationVariableKind.SECRET_REFERENCE ||
          !variable.credentialId
        ) {
          throw new BadRequestException('Saved variable is not a reusable secret reference');
        }
        const credential = await this.getReferenceCredential(
          variable,
          projectId,
          connectorName,
          ConfigurationVariableKind.SECRET_REFERENCE
        );
        return { _secrets_id: credential.id };
      }
      const credential = await this.getReferenceCredential(
        variable,
        projectId,
        connectorName,
        ConfigurationVariableKind.CREDENTIAL_REFERENCE
      );
      return { _source_credential_id: credential.id };
    }

    const resolved: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(object)) {
      if (key === '_secrets_id' && this.isMarker(child, SECRET_MARKER)) {
        const expanded = await this.resolveValue(
          child,
          projectId,
          connectorName,
          cache,
          path ? `${path}.${key}` : key
        );
        if (expanded && typeof expanded === 'object' && !Array.isArray(expanded)) {
          this.mergeObjects(resolved, expanded as Record<string, unknown>);
        }
        continue;
      }
      resolved[key] = await this.resolveValue(
        child,
        projectId,
        connectorName,
        cache,
        path ? `${path}.${key}` : key
      );
    }
    return resolved;
  }

  private async resolveValueForSave(
    value: unknown,
    projectId: string,
    connectorName: string,
    cache: Map<string, ConfigurationVariable>,
    path: string
  ): Promise<unknown> {
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) {
      return Promise.all(
        value.map((item, index) =>
          this.resolveValueForSave(item, projectId, connectorName, cache, `${path}[${index}]`)
        )
      );
    }

    const object = value as Record<string, unknown>;
    if (typeof object[SECRET_MARKER] === 'string') {
      this.assertStandaloneMarker(object, SECRET_MARKER, path);
      const variable = await this.getVariable(projectId, object[SECRET_MARKER] as string, cache);
      const credential = await this.getReferenceCredential(
        variable,
        projectId,
        connectorName,
        ConfigurationVariableKind.SECRET_REFERENCE
      );
      const { [SECRET_MARKER]: _marker, ...rest } = object;
      // Expand the shared project secret only in memory. The existing save
      // pipeline will extract these fields into a new Data-Mart-owned record.
      this.injectSecretsAtPaths(rest, credential.credentials);
      return rest;
    }
    if (typeof object[CREDENTIAL_MARKER] === 'string') {
      this.assertStandaloneMarker(object, CREDENTIAL_MARKER, path);
      const variable = await this.getVariable(
        projectId,
        object[CREDENTIAL_MARKER] as string,
        cache
      );
      const credential = await this.getReferenceCredential(
        variable,
        projectId,
        connectorName,
        ConfigurationVariableKind.CREDENTIAL_REFERENCE
      );
      const { [CREDENTIAL_MARKER]: _marker, ...rest } = object;
      return { ...rest, _source_credential_id: credential.id };
    }
    const markerEntries = [VALUE_MARKER, SECRET_MARKER, CREDENTIAL_MARKER].filter(
      key => key in object
    );
    if (markerEntries.length > 0) {
      if (markerEntries.length !== 1 || Object.keys(object).length !== 1) {
        throw new BadRequestException(
          `Invalid saved variable marker at ${path || 'connector configuration'}`
        );
      }
      const marker = markerEntries[0];
      const id = object[marker];
      if (typeof id !== 'string' || !id) {
        throw new BadRequestException(
          `Invalid saved variable id at ${path || 'connector configuration'}`
        );
      }
      const variable = await this.getVariable(projectId, id, cache);
      if (variable.connectorName && variable.connectorName !== connectorName) {
        throw new BadRequestException('Saved variable belongs to a different connector');
      }
      if (marker === VALUE_MARKER) {
        if (variable.kind !== ConfigurationVariableKind.VALUE) {
          throw new BadRequestException('Only value variables can be used as field values');
        }
        return variable.value;
      }
      if (marker === CREDENTIAL_MARKER) {
        const credential = await this.getReferenceCredential(
          variable,
          projectId,
          connectorName,
          ConfigurationVariableKind.CREDENTIAL_REFERENCE
        );
        return { _source_credential_id: credential.id };
      }
      if (variable.kind !== ConfigurationVariableKind.SECRET_REFERENCE || !variable.credentialId) {
        throw new BadRequestException('Saved variable is not a reusable secret reference');
      }
      const credential = await this.getReferenceCredential(
        variable,
        projectId,
        connectorName,
        ConfigurationVariableKind.SECRET_REFERENCE
      );
      return { _secrets_id: credential.id };
    }

    const resolved: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(object)) {
      if (key === '_secrets_id' && this.isMarker(child, SECRET_MARKER)) {
        const expanded = await this.resolveValueForSave(
          child,
          projectId,
          connectorName,
          cache,
          path ? `${path}.${key}` : key
        );
        if (expanded && typeof expanded === 'object' && !Array.isArray(expanded)) {
          this.mergeObjects(resolved, expanded as Record<string, unknown>);
        }
        continue;
      }
      resolved[key] = await this.resolveValueForSave(
        child,
        projectId,
        connectorName,
        cache,
        path ? `${path}.${key}` : key
      );
    }
    return resolved;
  }

  private async getReferenceCredential(
    variable: ConfigurationVariable,
    _projectId: string,
    connectorName: string,
    kind: ConfigurationVariableKind
  ) {
    if (variable.kind !== kind || !variable.credentialId) {
      throw new BadRequestException('Saved variable kind does not match this connector field');
    }
    const credential = await this.credentials.getCredentialsById(variable.credentialId);
    const expectedCredentialKind =
      kind === ConfigurationVariableKind.SECRET_REFERENCE ? 'secret' : 'oauth';
    const credentialKind = credential?.kind ?? (credential?.dataMartId ? 'secret' : 'oauth');
    if (
      !credential ||
      credential.connectorName !== connectorName ||
      credentialKind !== expectedCredentialKind
    ) {
      throw new BadRequestException('Reusable credential is no longer available');
    }
    return credential;
  }

  private injectSecretsAtPaths(
    obj: Record<string, unknown>,
    secrets: Record<string, unknown>
  ): void {
    for (const [secretPath, secretValue] of Object.entries(secrets)) {
      const parts = secretPath.split('.');
      let current = obj;
      for (let index = 0; index < parts.length - 1; index += 1) {
        const part = parts[index];
        if (!current[part] || typeof current[part] !== 'object') current[part] = {};
        current = current[part] as Record<string, unknown>;
      }
      current[parts[parts.length - 1]] = secretValue;
    }
  }

  private isMarker(value: unknown, marker: string): boolean {
    return Boolean(
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.keys(value as Record<string, unknown>).length === 1 &&
      marker in (value as Record<string, unknown>)
    );
  }

  private assertStandaloneMarker(
    object: Record<string, unknown>,
    marker: string,
    path: string
  ): void {
    const extraKeys = Object.keys(object).filter(
      key => ![marker, '_id', '_copiedFrom'].includes(key)
    );
    if (extraKeys.length > 0) {
      throw new BadRequestException(
        `Invalid saved variable marker at ${path || 'connector configuration'}`
      );
    }
    if (typeof object[marker] !== 'string' || !object[marker]) {
      throw new BadRequestException(
        `Invalid saved variable id at ${path || 'connector configuration'}`
      );
    }
  }

  private mergeObjects(
    target: Record<string, unknown>,
    source: Record<string, unknown>
  ): Record<string, unknown> {
    for (const [key, value] of Object.entries(source)) {
      if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        target[key] &&
        typeof target[key] === 'object' &&
        !Array.isArray(target[key])
      ) {
        this.mergeObjects(target[key] as Record<string, unknown>, value as Record<string, unknown>);
      } else {
        target[key] = value;
      }
    }
    return target;
  }

  private async getVariable(
    projectId: string,
    id: string,
    cache: Map<string, ConfigurationVariable>
  ): Promise<ConfigurationVariable> {
    const cached = cache.get(id);
    if (cached) return cached;
    const variable = await this.variables.resolve(projectId, id);
    cache.set(id, variable);
    this.logger.debug(`Resolved saved variable ${id} for project ${projectId}`);
    return variable;
  }
}
