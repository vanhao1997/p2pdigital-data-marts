import { Controller, ForbiddenException, Get, Param } from '@nestjs/common';
import { ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth, AuthContext, AuthorizationContext, Role, Strategy } from '../../idp';
import { RejectApiKeyAuth, RejectPluginAuth } from '../../idp/decorators';
import { ProjectOverviewResponseApiDto } from '../dto/presentation/project-overview-response-api.dto';
import { ProjectOverviewMapper } from '../mappers/project-overview.mapper';
import { GetProjectOverviewService } from '../use-cases/get-project-overview.service';

@Controller('project-overviews')
@ApiTags('Projects')
export class ProjectOverviewController {
  constructor(
    private readonly service: GetProjectOverviewService,
    private readonly mapper: ProjectOverviewMapper
  ) {}

  @Get(':projectId')
  @Auth(Role.viewer(Strategy.INTROSPECT))
  @RejectApiKeyAuth()
  @RejectPluginAuth()
  @ApiOperation({
    summary: 'Get a project overview',
    description:
      'Rechecks membership and uses target-project visibility. Does not change the active project.',
  })
  @ApiOkResponse({ type: ProjectOverviewResponseApiDto })
  @ApiForbiddenResponse({
    description: 'No access to this project; project-scoped machine credentials are not accepted.',
  })
  async get(
    @Param('projectId') projectId: string,
    @AuthContext() context: AuthorizationContext
  ): Promise<ProjectOverviewResponseApiDto> {
    if (context.viewOnly && projectId !== context.projectId) {
      throw new ForbiddenException('View-only access is restricted to the active project');
    }
    return this.mapper.toResponse(
      await this.service.run(this.mapper.toCommand(projectId, context))
    );
  }
}
