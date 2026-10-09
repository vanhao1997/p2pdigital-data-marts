import { Injectable } from '@nestjs/common';
import type { ConnectorDefinition } from '../connector-types/connector-definition';
import type { ConnectorFieldsSchema } from '../connector-types/connector-fields-schema';
import type {
  ConnectorSpecification,
  ConnectorSpecificationItem,
  ConnectorSpecificationSchema,
} from '../connector-types/connector-specification';
import { DataStorageDto } from '../dto/domain/data-storage.dto';
import {
  ValidationResult,
  ValidationResultCode,
} from '../data-storage-types/interfaces/data-storage-access-validator.interface';
import type {
  McpConnectorFieldGroup,
  McpConnectorSpecificationItem,
  McpConnectorSummary,
  McpDataStorageSetup,
  McpStorageCredentialStatus,
  McpValidateDataStorageResult,
} from '../facades/mcp-setup-storages.facade';

@Injectable()
export class McpSetupStoragesMapper {
  toStorage(
    dto: DataStorageDto,
    credentialStatus: McpStorageCredentialStatus
  ): McpDataStorageSetup {
    return {
      storageId: dto.id,
      title: dto.title,
      storageType: dto.type,
      ...(dto.credentialId && ['configured', 'expired'].includes(credentialStatus)
        ? { credentialId: dto.credentialId }
        : {}),
      credentialStatus,
      setupRequired: !dto.config || credentialStatus !== 'configured',
    };
  }

  toValidation(
    storage: McpDataStorageSetup,
    result: ValidationResult
  ): McpValidateDataStorageResult {
    if (result.valid) {
      return { ...storage, credentialStatus: 'configured', setupRequired: false, valid: true };
    }
    if (result.code === ValidationResultCode.UNCONFIGURED) {
      return {
        ...storage,
        setupRequired: true,
        valid: false,
        code: 'UNCONFIGURED',
        message: 'Complete storage setup in the web application before validating access.',
      };
    }
    if (result.code === ValidationResultCode.OAUTH_REAUTH_REQUIRED) {
      return {
        ...storage,
        credentialStatus: 'expired',
        setupRequired: true,
        valid: false,
        code: 'OAUTH_REAUTH_REQUIRED',
        message: 'Reconnect this storage in the web application to restore access.',
      };
    }
    return {
      ...storage,
      setupRequired: true,
      valid: false,
      message: 'Storage access validation failed. Check configuration in the web application.',
    };
  }

  toConnector(connector: ConnectorDefinition): McpConnectorSummary {
    return {
      name: connector.name,
      title: connector.title,
      description: connector.description ?? null,
      logo: connector.logo ?? null,
      docUrl: connector.docUrl ?? null,
    };
  }

  toSpecification(specification: ConnectorSpecification): McpConnectorSpecificationItem[] {
    return specification.map(item => this.toSpecificationItem(item));
  }

  toFields(schema: ConnectorFieldsSchema): McpConnectorFieldGroup[] {
    return schema.map(group => ({
      name: group.name,
      ...(group.overview !== undefined ? { overview: group.overview } : {}),
      ...(group.description !== undefined ? { description: group.description } : {}),
      ...(group.documentation !== undefined ? { documentation: group.documentation } : {}),
      ...(group.uniqueKeys !== undefined ? { uniqueKeys: [...group.uniqueKeys] } : {}),
      ...(group.uniqueKeysByDataLevel !== undefined
        ? {
            uniqueKeysByDataLevel: Object.fromEntries(
              Object.entries(group.uniqueKeysByDataLevel).map(([key, values]) => [key, [...values]])
            ),
          }
        : {}),
      ...(group.defaultFields !== undefined ? { defaultFields: [...group.defaultFields] } : {}),
      ...(group.destinationName !== undefined ? { destinationName: group.destinationName } : {}),
      ...(group.fields !== undefined
        ? {
            fields: group.fields.map(field => ({
              name: field.name,
              ...(field.label !== undefined ? { label: field.label } : {}),
              ...(field.type !== undefined ? { type: field.type } : {}),
              ...(field.description !== undefined ? { description: field.description } : {}),
            })),
          }
        : {}),
    }));
  }

  private toSpecificationItem(
    item: ConnectorSpecificationItem | ConnectorSpecificationSchema,
    inheritedSecret = false,
    inheritedOAuth = false
  ): McpConnectorSpecificationItem {
    const secret = inheritedSecret || item.attributes?.includes('SECRET') === true;
    const oauth = inheritedOAuth || item.attributes?.includes('OAUTH_FLOW') === true;
    const safe: McpConnectorSpecificationItem = {
      name: item.name,
      ...(item.title !== undefined ? { title: item.title } : {}),
      ...(item.description !== undefined ? { description: item.description } : {}),
      ...(item.requiredType !== undefined ? { requiredType: item.requiredType } : {}),
      ...(item.required !== undefined ? { required: item.required } : {}),
      secret,
      oauth,
      ...(item.minimum !== undefined ? { minimum: item.minimum } : {}),
    };
    if (!secret && !oauth) {
      if (
        typeof item.default === 'string' ||
        typeof item.default === 'number' ||
        typeof item.default === 'boolean' ||
        (Array.isArray(item.default) && item.default.every(value => typeof value === 'string'))
      ) {
        safe.default = item.default as string | number | boolean | string[];
      }
      if (item.options !== undefined) safe.options = [...item.options];
      if (item.placeholder !== undefined) safe.placeholder = item.placeholder;
    }
    if ('oneOf' in item && item.oneOf) {
      safe.oneOf = item.oneOf.map(option => ({
        label: option.label,
        value: option.value,
        ...(option.requiredType !== undefined ? { requiredType: option.requiredType } : {}),
        secret: secret || option.attributes?.includes('SECRET') === true,
        oauth: oauth || option.attributes?.includes('OAUTH_FLOW') === true,
        items: Object.fromEntries(
          Object.entries(option.items).map(([key, child]) => [
            key,
            this.toSpecificationItem(
              child,
              secret || option.attributes?.includes('SECRET'),
              oauth || option.attributes?.includes('OAUTH_FLOW')
            ),
          ])
        ),
      }));
    }
    return safe;
  }
}
