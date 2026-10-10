import { ForbiddenException, Injectable } from '@nestjs/common';
import { IdpProjectionsFacade } from '../../idp/facades/idp-projections.facade';
import { GetProjectOverviewCommand, ProjectOverviewDto } from '../dto/domain/project-overview.dto';
import { RoleScope } from '../enums/role-scope.enum';
import { ProjectOverviewMapper } from '../mappers/project-overview.mapper';
import { ProjectOverviewRepository } from '../repositories/project-overview.repository';
import { ContextAccessService } from '../services/context/context-access.service';

@Injectable()
export class GetProjectOverviewService {
  constructor(
    private readonly idp: IdpProjectionsFacade,
    private readonly contextAccess: ContextAccessService,
    private readonly repository: ProjectOverviewRepository,
    private readonly mapper: ProjectOverviewMapper
  ) {}

  async run(command: GetProjectOverviewCommand): Promise<ProjectOverviewDto> {
    // Resolve live membership in the TARGET project. The session's active-project role is not reusable here.
    const project = await this.idp.getProjectForUser(command.userId, command.projectId);
    const roles = project.roles ?? [];
    if (
      project.id !== command.projectId ||
      !roles.length ||
      (project.status !== 'active' && !(project.status === 'blocked' && project.archived === true))
    ) {
      throw new ForbiddenException('Project overview is not accessible');
    }
    const roleScope = roles.includes('admin')
      ? RoleScope.ENTIRE_PROJECT
      : await this.contextAccess.getRoleScope(command.userId, command.projectId);
    const rows = await this.repository.readVisible({
      dataMartAlias: 'dm',
      projectId: command.projectId,
      userId: command.userId,
      roles,
      roleScope,
    });
    return this.mapper.toDomain(command.projectId, rows);
  }
}
