import type { DataStorageType } from '../data-storage-types/enums/data-storage-type.enum';

export const MCP_SETUP_STORAGES_FACADE = Symbol('MCP_SETUP_STORAGES_FACADE');

export interface McpStorageSetupContext {
  projectId: string;
  userId: string;
  roles: string[];
}

export type McpStorageCredentialStatus = 'missing' | 'configured' | 'expired' | 'unknown';

export interface McpDataStorageSetup {
  storageId: string;
  title: string;
  storageType: DataStorageType;
  credentialId?: string;
  credentialStatus: McpStorageCredentialStatus;
  setupRequired: boolean;
}

export interface McpListDataStoragesResult {
  dataStorages: McpDataStorageSetup[];
}

export interface McpConnectorSummary {
  name: string;
  title: string;
  description: string | null;
  logo: string | null;
  docUrl: string | null;
}

export interface McpListConnectorsResult {
  connectors: McpConnectorSummary[];
}

export interface McpConnectorRequest extends McpStorageSetupContext {
  connectorName: string;
}

export interface McpConnectorSpecificationItem {
  name: string;
  title?: string;
  description?: string;
  requiredType?: 'string' | 'number' | 'boolean' | 'bool' | 'object' | 'array' | 'date';
  required?: boolean;
  secret: boolean;
  oauth: boolean;
  default?: string | number | boolean | string[];
  options?: string[];
  placeholder?: string;
  minimum?: number;
  oneOf?: McpConnectorSpecificationOption[];
}

export interface McpConnectorSpecificationOption {
  label: string;
  value: string;
  requiredType?: 'string' | 'number' | 'boolean' | 'bool' | 'object' | 'array' | 'date';
  secret: boolean;
  oauth: boolean;
  items: Record<string, McpConnectorSpecificationItem>;
}

export interface McpGetConnectorSpecificationResult {
  connectorName: string;
  specification: McpConnectorSpecificationItem[];
}

export interface McpConnectorField {
  name: string;
  label?: string;
  type?: string;
  description?: string;
}

export interface McpConnectorFieldGroup {
  name: string;
  overview?: string;
  description?: string;
  documentation?: string;
  uniqueKeys?: string[];
  uniqueKeysByDataLevel?: Record<string, string[]>;
  defaultFields?: string[];
  destinationName?: string;
  fields?: McpConnectorField[];
}

export interface McpGetConnectorFieldsResult {
  connectorName: string;
  fields: McpConnectorFieldGroup[];
}

export interface McpCreateDataStorageRequest extends McpStorageSetupContext {
  storageType: DataStorageType;
  title: string;
}

export interface McpConfigureDataStorageRequest extends McpStorageSetupContext {
  storageId: string;
  title: string;
  config: Record<string, unknown>;
  /** Exactly one reference is required; credentials are reused only after project and copy checks. */
  credentialId?: string;
  sourceStorageId?: string;
}

export interface McpValidateDataStorageRequest extends McpStorageSetupContext {
  storageId: string;
}

export interface McpValidateDataStorageResult extends McpDataStorageSetup {
  valid: boolean;
  code?: 'UNCONFIGURED' | 'OAUTH_REAUTH_REQUIRED';
  message?: string;
}

export interface McpSetupStoragesFacade {
  listDataStorages(request: McpStorageSetupContext): Promise<McpListDataStoragesResult>;
  listConnectors(request: McpStorageSetupContext): Promise<McpListConnectorsResult>;
  getConnectorSpecification(
    request: McpConnectorRequest
  ): Promise<McpGetConnectorSpecificationResult>;
  getConnectorFields(request: McpConnectorRequest): Promise<McpGetConnectorFieldsResult>;
  createDataStorage(request: McpCreateDataStorageRequest): Promise<McpDataStorageSetup>;
  configureDataStorage(request: McpConfigureDataStorageRequest): Promise<McpDataStorageSetup>;
  validateDataStorage(
    request: McpValidateDataStorageRequest
  ): Promise<McpValidateDataStorageResult>;
}
