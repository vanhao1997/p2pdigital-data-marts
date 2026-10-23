import { ScheduledTriggerType } from '../enums';
import type { ProjectScheduledTrigger } from '../model/scheduled-trigger.model';

export interface TriggerGroupMemberRef {
  triggerId: string;
  dataMartId: string;
  type: ScheduledTriggerType;
  reportId?: string;
}

export type TriggerGroupReportSelectionMode = 'all' | 'selected';

export interface TriggerGroup {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  dataMartIds: string[];
  triggerTypes: ScheduledTriggerType[];
  reportSelectionMode: TriggerGroupReportSelectionMode;
  selectedReportIds: string[];
  cronExpression: string;
  timeZone: string;
  isActive: boolean;
  memberTriggerRefs: TriggerGroupMemberRef[];
  createdAt: string;
  updatedAt: string;
}

export interface TriggerGroupDraft {
  name: string;
  description?: string;
  dataMartIds: string[];
  triggerTypes: ScheduledTriggerType[];
  reportSelectionMode: TriggerGroupReportSelectionMode;
  selectedReportIds: string[];
  cronExpression: string;
  timeZone: string;
  isActive: boolean;
}

export interface DiscoveredTriggerCluster {
  key: string;
  cronExpression: string;
  timeZone: string;
  triggerTypes: ScheduledTriggerType[];
  dataMarts: { id: string; title: string }[];
  triggers: ProjectScheduledTrigger[];
}

export interface TriggerGroupSyncResult {
  group: TriggerGroup;
  createdCount: number;
  updatedCount: number;
  removedCount: number;
  skippedCount: number;
  errors: string[];
}
