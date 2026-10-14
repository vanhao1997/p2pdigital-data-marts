import { ApiProperty } from '@nestjs/swagger';

export class ProjectSettingsResponseApiDto {
  @ApiProperty({ type: String, nullable: true })
  description: string | null;

  @ApiProperty({ type: String, nullable: true, required: false })
  logoUrl?: string | null;
}
