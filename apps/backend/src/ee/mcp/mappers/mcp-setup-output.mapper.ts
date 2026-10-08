import type { McpDataStorageSetup } from '../../../data-marts/facades/mcp-setup-storages.facade';
import type { McpDataMartSetup } from '../../../data-marts/facades/mcp-setup-data-marts.facade';
import { buildDataMartUiPath } from '../tools/data-mart-ui-path';
import { joinPublicOrigin } from '../tools/mcp-public-url.util';
import {
  dataStorageSetupOutputSchema,
  dataMartSetupOutputSchema,
} from '../tools/mcp-setup.schemas';

export function mapStorageSetup(dto: McpDataStorageSetup, projectId: string, origin: string) {
  return dataStorageSetupOutputSchema.parse({
    storage_id: dto.storageId,
    title: dto.title,
    storage_type: dto.storageType,
    credential_status: dto.credentialStatus,
    setup_required: dto.setupRequired,
    configuration_url: joinPublicOrigin(
      origin,
      `/ui/${encodeURIComponent(projectId)}/data-storages?id=${encodeURIComponent(dto.storageId)}`
    ),
  });
}

export function mapDataMartSetup(dto: McpDataMartSetup, projectId: string, origin: string) {
  return dataMartSetupOutputSchema.parse({
    data_mart_id: dto.dataMartId,
    title: dto.title,
    ...(typeof dto.description === 'string' ? { description: dto.description } : {}),
    status: dto.status,
    ...(dto.definitionType ? { definition_type: dto.definitionType } : {}),
    storage_id: dto.storageId,
    credential_status: dto.credentialStatus,
    setup_required: dto.setupRequired,
    configuration_url: joinPublicOrigin(origin, buildDataMartUiPath(projectId, dto.dataMartId)),
    ...(dto.connector
      ? {
          connector: {
            name: dto.connector.name,
            configuration_ids: [...dto.connector.configurationIds],
          },
        }
      : {}),
    ...(dto.latestRun
      ? {
          latest_run: {
            id: dto.latestRun.id,
            status: dto.latestRun.status,
            type: dto.latestRun.type,
            created_at: dto.latestRun.createdAt,
          },
        }
      : {}),
    ...(dto.setupError
      ? { setup_error: { code: dto.setupError.code, message: dto.setupError.message } }
      : {}),
  });
}
