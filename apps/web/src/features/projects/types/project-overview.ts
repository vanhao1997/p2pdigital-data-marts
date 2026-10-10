import type { DataMartStatus } from '../../data-marts/shared/enums';

export interface ProjectOverview {
  projectId: string;
  dataMartsCount: number;
  dataMarts: { id: string; title: string; status: DataMartStatus }[];
  connectors: { name: string; dataMartsCount: number }[];
  runningSyncsCount: number;
  observedAt: string;
}
