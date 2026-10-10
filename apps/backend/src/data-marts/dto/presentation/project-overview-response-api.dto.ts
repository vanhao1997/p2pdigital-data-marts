import { ApiProperty } from '@nestjs/swagger';
import { DataMartStatus } from '../../enums/data-mart-status.enum';

export class ProjectOverviewDataMartApiDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ enum: DataMartStatus })
  status: DataMartStatus;
}

export class ProjectOverviewConnectorApiDto {
  @ApiProperty()
  name: string;

  @ApiProperty({ type: 'integer', minimum: 0 })
  dataMartsCount: number;
}

export class ProjectOverviewResponseApiDto {
  @ApiProperty()
  projectId: string;

  @ApiProperty({ type: 'integer', minimum: 0 })
  dataMartsCount: number;

  @ApiProperty({
    type: [ProjectOverviewDataMartApiDto],
    description: 'Up to 5 visible Data Marts, newest first.',
  })
  dataMarts: ProjectOverviewDataMartApiDto[];

  @ApiProperty({ type: [ProjectOverviewConnectorApiDto] })
  connectors: ProjectOverviewConnectorApiDto[];

  @ApiProperty({
    type: 'integer',
    minimum: 0,
    description:
      'Visible CONNECTOR runs with RUNNING status; excludes queued runs and report exports.',
  })
  runningSyncsCount: number;

  @ApiProperty({ type: String, format: 'date-time' })
  observedAt: string;
}
