import { Injectable } from '@nestjs/common';
import { AuthorizationContext } from '../../idp';
import { GetProjectOverviewCommand, ProjectOverviewDto } from '../dto/domain/project-overview.dto';
import { ProjectOverviewResponseApiDto } from '../dto/presentation/project-overview-response-api.dto';
import { ProjectOverviewRows } from '../repositories/project-overview.repository';

@Injectable()
export class ProjectOverviewMapper {
  toCommand(projectId: string, context: AuthorizationContext): GetProjectOverviewCommand {
    return new GetProjectOverviewCommand(projectId, context.userId);
  }

  toDomain(projectId: string, rows: ProjectOverviewRows): ProjectOverviewDto {
    return new ProjectOverviewDto(
      projectId,
      rows.total,
      rows.dataMarts,
      rows.connectors.map(row => ({ name: row.name, dataMartsCount: Number(row.count) })),
      rows.runningSyncs,
      new Date()
    );
  }

  toResponse(dto: ProjectOverviewDto): ProjectOverviewResponseApiDto {
    return {
      projectId: dto.projectId,
      dataMartsCount: dto.dataMartsCount,
      dataMarts: dto.dataMarts,
      connectors: dto.connectors,
      runningSyncsCount: dto.runningSyncsCount,
      observedAt: dto.observedAt.toISOString(),
    };
  }
}
