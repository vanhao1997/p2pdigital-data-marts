import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Role } from '@owox/idp-protocol';
import {
  IsBoolean,
  IsISO8601,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateProjectMemberApiKeyRequestDto {
  @ApiProperty({ description: 'User-facing name for the API key' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: 'Optional expiration date (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;

  @ApiPropertyOptional({ enum: ['admin', 'editor', 'viewer'] })
  @IsOptional()
  @IsIn(['admin', 'editor', 'viewer'])
  role?: Role;

  @ApiPropertyOptional({ description: 'Restrict this key to read-only operations' })
  @IsOptional()
  @IsBoolean()
  readOnly?: boolean;
}

export class UpdateProjectMemberApiKeyRequestDto {
  @ApiProperty({ description: 'New name for the API key' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;
}

export class ProjectMemberApiKeyResponseDto {
  @ApiProperty()
  apiKeyId: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ nullable: true })
  expiresAt: string | null;

  @ApiProperty()
  createdAt: string;

  @ApiProperty({ nullable: true })
  lastAuthenticatedAt: string | null;

  @ApiProperty({ enum: ['admin', 'editor', 'viewer'], nullable: true })
  role: Role | null;

  @ApiProperty()
  readOnly: boolean;
}

export class CreateProjectMemberApiKeyResponseDto extends ProjectMemberApiKeyResponseDto {
  @ApiProperty({ description: 'Full API key value shown only once at creation time' })
  apiKey: string;
}
