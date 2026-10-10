import { DataMartStatus } from '../../enums/data-mart-status.enum';

export class GetProjectOverviewCommand {
  constructor(
    public readonly projectId: string,
    public readonly userId: string
  ) {}
}

export interface ProjectOverviewDataMartDto {
  id: string;
  title: string;
  status: DataMartStatus;
}

export interface ProjectOverviewConnectorDto {
  name: string;
  dataMartsCount: number;
}

export class ProjectOverviewDto {
  constructor(
    public readonly projectId: string,
    public readonly dataMartsCount: number,
    public readonly dataMarts: ProjectOverviewDataMartDto[],
    public readonly connectors: ProjectOverviewConnectorDto[],
    public readonly runningSyncsCount: number,
    public readonly observedAt: Date
  ) {}
}
