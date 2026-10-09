import { DataMartDefinitionType } from '../enums/data-mart-definition-type.enum';

export const MCP_SETUP_DATA_MARTS_FACADE = Symbol('MCP_SETUP_DATA_MARTS_FACADE');

export interface McpDataMartActor {
  projectId: string;
  userId: string;
  roles: string[];
}

export interface McpDataMartDefinitionInput {
  definitionType?: DataMartDefinitionType;
  definition?: unknown;
  sourceDataMartId?: string;
  sourceConfigurationId?: string;
}

export interface McpCreateDataMartRequest extends McpDataMartActor, McpDataMartDefinitionInput {
  title: string;
  storageId: string;
  description?: string;
}

export interface McpUpdateDataMartRequest extends McpDataMartActor, McpDataMartDefinitionInput {
  dataMartId: string;
  title?: string;
  description?: string;
}

export interface McpDataMartSetupRequest extends McpDataMartActor {
  dataMartId: string;
}

export type McpDataMartCredentialStatus = 'missing' | 'configured' | 'expired' | 'unknown';

export interface McpDataMartSetupError {
  code: string;
  message: string;
}

export interface McpDataMartSetup {
  dataMartId: string;
  title: string;
  description?: string;
  status: string;
  definitionType?: DataMartDefinitionType;
  storageId: string;
  credentialStatus: McpDataMartCredentialStatus;
  setupRequired: boolean;
  configurationUrl: string;
  connector?: { name: string; configurationIds: string[] };
  latestRun?: { id: string; status: string; type: string; createdAt: string };
  /** A saved draft/update exists; continue with its ID rather than creating another one. */
  setupError?: McpDataMartSetupError;
}

export interface McpValidateDataMartResponse {
  dataMart: McpDataMartSetup;
  valid: boolean;
  error?: McpDataMartSetupError;
}

export interface McpPublishDataMartResponse extends McpDataMartSetup {
  /** Publish can schedule an incremental run; this does not claim sync completion. */
  connectorRunMayStart: boolean;
}

export interface McpSetupDataMartsFacade {
  createDataMart(request: McpCreateDataMartRequest): Promise<McpDataMartSetup>;
  updateDataMart(request: McpUpdateDataMartRequest): Promise<McpDataMartSetup>;
  validateDataMart(request: McpDataMartSetupRequest): Promise<McpValidateDataMartResponse>;
  publishDataMart(request: McpDataMartSetupRequest): Promise<McpPublishDataMartResponse>;
  getDataMartSetupStatus(request: McpDataMartSetupRequest): Promise<McpDataMartSetup>;
}
