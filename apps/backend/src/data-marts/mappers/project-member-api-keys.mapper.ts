import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  CreateProjectMemberApiKeyResponseDto,
  ProjectMemberApiKeyResponseDto,
} from '../dto/presentation/project-member-api-key-api.dto';
import type {
  CreateProjectMemberApiKeyRequestDto,
  UpdateProjectMemberApiKeyRequestDto,
} from '../dto/presentation/project-member-api-key-api.dto';
import type { ProjectMemberApiKeyMetadata } from '../../project-member-api-keys/dto/domain/project-member-api-key-metadata.dto';
import type { AuthorizationContext } from '../../idp';
import { CreateProjectMemberApiKeyCommand } from '../dto/domain/create-project-member-api-key.command';
import { ListProjectMemberApiKeysCommand } from '../dto/domain/list-project-member-api-keys.command';
import { UpdateProjectMemberApiKeyCommand } from '../dto/domain/update-project-member-api-key.command';
import { RevokeProjectMemberApiKeyCommand } from '../dto/domain/revoke-project-member-api-key.command';

@Injectable()
export class ProjectMemberApiKeysMapper {
  toListCommand(
    context: AuthorizationContext,
    includeRevoked: boolean
  ): ListProjectMemberApiKeysCommand {
    return new ListProjectMemberApiKeysCommand(context.projectId, context.userId, includeRevoked);
  }

  toCreateCommand(
    context: AuthorizationContext,
    dto: CreateProjectMemberApiKeyRequestDto
  ): CreateProjectMemberApiKeyCommand {
    return new CreateProjectMemberApiKeyCommand(
      context.projectId,
      context.userId,
      dto.name,
      this.resolveRole(context, dto.role),
      dto.expiresAt,
      Boolean(context.viewOnly || dto.readOnly)
    );
  }

  private resolveRole(
    context: AuthorizationContext,
    requestedRole?: CreateProjectMemberApiKeyRequestDto['role']
  ): CreateProjectMemberApiKeyCommand['role'] {
    const currentRole = (context.roles ?? []).reduce<CreateProjectMemberApiKeyCommand['role']>(
      (highest, role) => {
        if (!highest) return role;
        return this.roleRank(role) > this.roleRank(highest) ? role : highest;
      },
      null
    );

    if (!requestedRole) return currentRole;
    if (!currentRole || this.roleRank(requestedRole) > this.roleRank(currentRole)) {
      throw new ForbiddenException('API key role cannot exceed the requester role');
    }
    return requestedRole;
  }

  private roleRank(role: NonNullable<CreateProjectMemberApiKeyCommand['role']>): number {
    return role === 'admin' ? 3 : role === 'editor' ? 2 : 1;
  }

  toUpdateCommand(
    context: AuthorizationContext,
    apiKeyId: string,
    dto: UpdateProjectMemberApiKeyRequestDto
  ): UpdateProjectMemberApiKeyCommand {
    return new UpdateProjectMemberApiKeyCommand(
      context.projectId,
      context.userId,
      apiKeyId,
      dto.name
    );
  }

  toRevokeCommand(
    context: AuthorizationContext,
    apiKeyId: string
  ): RevokeProjectMemberApiKeyCommand {
    return new RevokeProjectMemberApiKeyCommand(context.projectId, context.userId, apiKeyId);
  }

  toApiResponse(data: ProjectMemberApiKeyMetadata): ProjectMemberApiKeyResponseDto {
    return {
      apiKeyId: data.apiKeyId,
      name: data.name,
      expiresAt: data.expiresAt?.toISOString() ?? null,
      createdAt: data.createdAt.toISOString(),
      lastAuthenticatedAt: data.lastAuthenticatedAt?.toISOString() ?? null,
      role: data.role,
      readOnly: data.readOnly,
    };
  }

  toCreateApiResponse(
    data: ProjectMemberApiKeyMetadata & { apiKey: string }
  ): CreateProjectMemberApiKeyResponseDto {
    const response = new CreateProjectMemberApiKeyResponseDto();
    Object.assign(response, this.toApiResponse(data));
    response.apiKey = data.apiKey;
    return response;
  }
}
