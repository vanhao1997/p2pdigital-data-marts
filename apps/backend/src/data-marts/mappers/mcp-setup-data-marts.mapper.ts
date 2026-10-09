import { Injectable } from '@nestjs/common';
import { DataMartDto } from '../dto/domain/data-mart.dto';
import { DataMartRunDto } from '../dto/domain/data-mart-run.dto';
import { DataMartDefinitionType } from '../enums/data-mart-definition-type.enum';
import {
  McpDataMartCredentialStatus,
  McpDataMartSetup,
} from '../facades/mcp-setup-data-marts.facade';

@Injectable()
export class McpSetupDataMartsMapper {
  toSetupDto(
    dataMart: DataMartDto,
    projectId: string,
    credentialStatus: McpDataMartCredentialStatus,
    latestRun?: DataMartRunDto
  ): McpDataMartSetup {
    return {
      dataMartId: dataMart.id,
      title: dataMart.title,
      ...(typeof dataMart.description === 'string' ? { description: dataMart.description } : {}),
      status: dataMart.status,
      ...(dataMart.definitionType ? { definitionType: dataMart.definitionType } : {}),
      storageId: dataMart.storage.id,
      credentialStatus,
      setupRequired:
        !dataMart.definition ||
        !dataMart.definitionType ||
        !dataMart.storage.config ||
        credentialStatus !== 'configured',
      configurationUrl: `/ui/${encodeURIComponent(projectId)}/data-marts/${encodeURIComponent(dataMart.id)}/data-setup`,
      ...(dataMart.definitionType === DataMartDefinitionType.CONNECTOR &&
      dataMart.definition &&
      'connector' in dataMart.definition
        ? {
            connector: {
              name: dataMart.definition.connector.source.name,
              configurationIds: dataMart.definition.connector.source.configuration.flatMap(
                config => (typeof config._id === 'string' ? [config._id] : [])
              ),
            },
          }
        : {}),
      ...(latestRun
        ? {
            latestRun: {
              id: latestRun.id,
              status: latestRun.status,
              type: latestRun.type,
              createdAt: latestRun.createdAt.toISOString(),
            },
          }
        : {}),
    };
  }
}
