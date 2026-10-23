import { extractApiError } from '../../../../app/api';
import { DataDestinationType } from '../../../data-destination';
import { reportService, type ReportResponseDto } from '../../reports/shared/services';
import {
  DataMartDefinitionType,
  DataMartStatus,
  dataMartService,
  type DataMartListItemResponseDto,
} from '../../shared';
import { ScheduledTriggerType, TRIGGER_CONFIG_TYPES } from '../enums';
import type { ProjectScheduledTrigger } from '../model/scheduled-trigger.model';
import { scheduledTriggerService } from '../services';
import type {
  TriggerGroup,
  TriggerGroupDraft,
  TriggerGroupMemberRef,
  TriggerGroupSyncResult,
} from './trigger-group.model';
import {
  getTriggerReportId,
  loadTriggerGroups,
  saveTriggerGroups,
} from './trigger-group.storage';

function generateGroupId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `tg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function isReportSchedulable(report: ReportResponseDto): boolean {
  return report.dataDestinationAccess.type !== DataDestinationType.LOOKER_STUDIO;
}

export interface SyncTriggerGroupParams {
  projectId: string;
  draft: TriggerGroupDraft;
  existingGroup?: TriggerGroup;
  existingTriggers: ProjectScheduledTrigger[];
  dataMarts?: DataMartListItemResponseDto[];
  reports?: ReportResponseDto[];
  removeOrphanedTriggers?: boolean;
}

/**
 * Creates or updates a TriggerGroup and synchronizes all member triggers across the
 * selected Data Marts on the backend.
 */
export async function syncTriggerGroupWithBackend({
  projectId,
  draft,
  existingGroup,
  existingTriggers,
  dataMarts,
  reports,
  removeOrphanedTriggers = false,
}: SyncTriggerGroupParams): Promise<TriggerGroupSyncResult> {
  const resolvedDataMarts =
    dataMarts ??
    (await dataMartService.getDataMarts().catch(() => [] as DataMartListItemResponseDto[]));
  const dataMartById = new Map(resolvedDataMarts.map(dm => [dm.id, dm]));

  const needsReports = draft.triggerTypes.includes(ScheduledTriggerType.REPORT_RUN);
  const resolvedReports = needsReports
    ? (reports ??
      (await reportService.getReportsByProject().catch(() => [] as ReportResponseDto[])))
    : [];

  const nextMemberRefs: TriggerGroupMemberRef[] = [];
  const desiredSlotKeys = new Set<string>();
  let createdCount = 0;
  let updatedCount = 0;
  let removedCount = 0;
  let skippedCount = 0;
  const errors: string[] = [];

  const findExistingTrigger = (
    dataMartId: string,
    type: ScheduledTriggerType,
    reportId?: string
  ): ProjectScheduledTrigger | undefined => {
    // Prefer a trigger already referenced by existingGroup if present
    if (existingGroup) {
      const refMatch = existingGroup.memberTriggerRefs.find(
        ref =>
          ref.dataMartId === dataMartId &&
          ref.type === type &&
          (type !== ScheduledTriggerType.REPORT_RUN || ref.reportId === reportId)
      );
      if (refMatch) {
        const byId = existingTriggers.find(t => t.id === refMatch.triggerId);
        if (byId) return byId;
      }
    }

    // Fallback: match any existing trigger on the same Data Mart for the same slot
    return existingTriggers.find(t => {
      if (t.dataMart.id !== dataMartId || t.type !== type) return false;
      if (type === ScheduledTriggerType.REPORT_RUN) {
        return getTriggerReportId(t) === reportId;
      }
      return true;
    });
  };

  for (const dataMartId of draft.dataMartIds) {
    const dmInfo = dataMartById.get(dataMartId);
    const dmTitle = dmInfo?.title ?? dataMartId;

    if (dmInfo && dmInfo.status !== DataMartStatus.PUBLISHED) {
      skippedCount += 1;
      continue;
    }

    for (const triggerType of draft.triggerTypes) {
      if (triggerType === ScheduledTriggerType.CONNECTOR_RUN) {
        if (dmInfo && dmInfo.definitionType !== DataMartDefinitionType.CONNECTOR) {
          skippedCount += 1;
          continue;
        }

        const slotKey = `${dataMartId}__${ScheduledTriggerType.CONNECTOR_RUN}`;
        desiredSlotKeys.add(slotKey);
        const existing = findExistingTrigger(dataMartId, ScheduledTriggerType.CONNECTOR_RUN);

        try {
          if (existing) {
            await scheduledTriggerService.updateScheduledTrigger(dataMartId, existing.id, {
              cronExpression: draft.cronExpression,
              timeZone: draft.timeZone,
              isActive: draft.isActive,
            });
            updatedCount += 1;
            nextMemberRefs.push({
              triggerId: existing.id,
              dataMartId,
              type: ScheduledTriggerType.CONNECTOR_RUN,
            });
          } else {
            const created = await scheduledTriggerService.createScheduledTrigger(dataMartId, {
              type: ScheduledTriggerType.CONNECTOR_RUN,
              cronExpression: draft.cronExpression,
              timeZone: draft.timeZone,
              isActive: draft.isActive,
              triggerConfig: null,
            });
            createdCount += 1;
            nextMemberRefs.push({
              triggerId: created.id,
              dataMartId,
              type: ScheduledTriggerType.CONNECTOR_RUN,
            });
          }
        } catch (err) {
          errors.push(`${dmTitle} (Connector): ${extractApiError(err).message ?? 'Lỗi đồng bộ'}`);
        }
      } else if (triggerType === ScheduledTriggerType.DATA_QUALITY_RUN) {
        const slotKey = `${dataMartId}__${ScheduledTriggerType.DATA_QUALITY_RUN}`;
        desiredSlotKeys.add(slotKey);
        const existing = findExistingTrigger(dataMartId, ScheduledTriggerType.DATA_QUALITY_RUN);

        try {
          if (existing) {
            await scheduledTriggerService.updateScheduledTrigger(dataMartId, existing.id, {
              cronExpression: draft.cronExpression,
              timeZone: draft.timeZone,
              isActive: draft.isActive,
            });
            updatedCount += 1;
            nextMemberRefs.push({
              triggerId: existing.id,
              dataMartId,
              type: ScheduledTriggerType.DATA_QUALITY_RUN,
            });
          } else {
            const created = await scheduledTriggerService.createScheduledTrigger(dataMartId, {
              type: ScheduledTriggerType.DATA_QUALITY_RUN,
              cronExpression: draft.cronExpression,
              timeZone: draft.timeZone,
              isActive: draft.isActive,
              triggerConfig: null,
            });
            createdCount += 1;
            nextMemberRefs.push({
              triggerId: created.id,
              dataMartId,
              type: ScheduledTriggerType.DATA_QUALITY_RUN,
            });
          }
        } catch (err) {
          errors.push(
            `${dmTitle} (Chất lượng dữ liệu): ${extractApiError(err).message ?? 'Lỗi đồng bộ'}`
          );
        }
      } else {
        const dmReports = resolvedReports.filter(
          r => r.dataMart.id === dataMartId && isReportSchedulable(r)
        );
        const targetReports =
          draft.reportSelectionMode === 'selected' && draft.selectedReportIds.length > 0
            ? dmReports.filter(r => draft.selectedReportIds.includes(r.id))
            : dmReports;

        if (targetReports.length === 0) {
          skippedCount += 1;
          continue;
        }

        for (const report of targetReports) {
          const slotKey = `${dataMartId}__${ScheduledTriggerType.REPORT_RUN}__${report.id}`;
          desiredSlotKeys.add(slotKey);
          const existing = findExistingTrigger(
            dataMartId,
            ScheduledTriggerType.REPORT_RUN,
            report.id
          );

          try {
            if (existing) {
              await scheduledTriggerService.updateScheduledTrigger(dataMartId, existing.id, {
                cronExpression: draft.cronExpression,
                timeZone: draft.timeZone,
                isActive: draft.isActive,
              });
              updatedCount += 1;
              nextMemberRefs.push({
                triggerId: existing.id,
                dataMartId,
                type: ScheduledTriggerType.REPORT_RUN,
                reportId: report.id,
              });
            } else {
              const created = await scheduledTriggerService.createScheduledTrigger(dataMartId, {
                type: ScheduledTriggerType.REPORT_RUN,
                cronExpression: draft.cronExpression,
                timeZone: draft.timeZone,
                isActive: draft.isActive,
                triggerConfig: {
                  type: TRIGGER_CONFIG_TYPES.SCHEDULED_REPORT_RUN,
                  reportId: report.id,
                },
              });
              createdCount += 1;
              nextMemberRefs.push({
                triggerId: created.id,
                dataMartId,
                type: ScheduledTriggerType.REPORT_RUN,
                reportId: report.id,
              });
            }
          } catch (err) {
            errors.push(
              `${dmTitle} (${report.title}): ${extractApiError(err).message ?? 'Lỗi đồng bộ'}`
            );
          }
        }
      }
    }
  }

  // Optionally delete orphaned triggers that were removed from an existing group
  if (existingGroup && removeOrphanedTriggers) {
    for (const prevRef of existingGroup.memberTriggerRefs) {
      const prevSlotKey =
        prevRef.type === ScheduledTriggerType.REPORT_RUN && prevRef.reportId
          ? `${prevRef.dataMartId}__${prevRef.type}__${prevRef.reportId}`
          : `${prevRef.dataMartId}__${prevRef.type}`;
      if (!desiredSlotKeys.has(prevSlotKey)) {
        try {
          await scheduledTriggerService.deleteScheduledTrigger(
            prevRef.dataMartId,
            prevRef.triggerId
          );
          removedCount += 1;
        } catch {
          // Ignore if already deleted
        }
      }
    }
  }

  const now = new Date().toISOString();
  const savedGroup: TriggerGroup = {
    id: existingGroup?.id ?? generateGroupId(),
    projectId,
    name: draft.name.trim(),
    description: draft.description?.trim() ? draft.description.trim() : undefined,
    dataMartIds: draft.dataMartIds,
    triggerTypes: draft.triggerTypes,
    reportSelectionMode: draft.reportSelectionMode,
    selectedReportIds: draft.selectedReportIds,
    cronExpression: draft.cronExpression,
    timeZone: draft.timeZone,
    isActive: draft.isActive,
    memberTriggerRefs: nextMemberRefs,
    createdAt: existingGroup?.createdAt ?? now,
    updatedAt: now,
  };

  const currentGroups = loadTriggerGroups(projectId);
  const existingIdx = currentGroups.findIndex(g => g.id === savedGroup.id);
  const nextGroups =
    existingIdx >= 0
      ? currentGroups.map((g, idx) => (idx === existingIdx ? savedGroup : g))
      : [savedGroup, ...currentGroups];
  saveTriggerGroups(projectId, nextGroups);

  return {
    group: savedGroup,
    createdCount,
    updatedCount,
    removedCount,
    skippedCount,
    errors,
  };
}

/**
 * Toggles `isActive` for an entire TriggerGroup and updates all member triggers on the backend.
 */
export async function toggleTriggerGroupActiveOnBackend(
  projectId: string,
  group: TriggerGroup,
  isActive: boolean,
  existingTriggers: ProjectScheduledTrigger[]
): Promise<{ updatedCount: number; failedCount: number }> {
  const triggerById = new Map(existingTriggers.map(t => [t.id, t]));
  let updatedCount = 0;
  let failedCount = 0;

  for (const ref of group.memberTriggerRefs) {
    const existing = triggerById.get(ref.triggerId);
    const cronExpression = existing?.cronExpression ?? group.cronExpression;
    const timeZone = existing?.timeZone ?? group.timeZone;

    try {
      await scheduledTriggerService.updateScheduledTrigger(ref.dataMartId, ref.triggerId, {
        cronExpression,
        timeZone,
        isActive,
      });
      updatedCount += 1;
    } catch {
      failedCount += 1;
    }
  }

  const currentGroups = loadTriggerGroups(projectId);
  const nextGroups = currentGroups.map(g =>
    g.id === group.id ? { ...g, isActive, updatedAt: new Date().toISOString() } : g
  );
  saveTriggerGroups(projectId, nextGroups);

  return { updatedCount, failedCount };
}

/**
 * Deletes a TriggerGroup and optionally deletes all its member triggers on the backend.
 */
export async function deleteTriggerGroupOnBackend(
  projectId: string,
  group: TriggerGroup,
  deleteMemberTriggers: boolean
): Promise<{ deletedCount: number; failedCount: number }> {
  let deletedCount = 0;
  let failedCount = 0;

  if (deleteMemberTriggers) {
    for (const ref of group.memberTriggerRefs) {
      try {
        await scheduledTriggerService.deleteScheduledTrigger(ref.dataMartId, ref.triggerId);
        deletedCount += 1;
      } catch {
        failedCount += 1;
      }
    }
  }

  const currentGroups = loadTriggerGroups(projectId).filter(g => g.id !== group.id);
  saveTriggerGroups(projectId, currentGroups);

  return { deletedCount, failedCount };
}

/**
 * Updates schedule (cronExpression, timeZone, isActive) for multiple triggers at once.
 */
export async function bulkUpdateTriggersSchedule(
  triggers: ProjectScheduledTrigger[],
  schedule: { cronExpression: string; timeZone: string; isActive: boolean }
): Promise<{ updatedCount: number; failedCount: number }> {
  let updatedCount = 0;
  let failedCount = 0;

  for (const trigger of triggers) {
    if (!trigger.canEdit) {
      failedCount += 1;
      continue;
    }
    try {
      await scheduledTriggerService.updateScheduledTrigger(trigger.dataMart.id, trigger.id, {
        cronExpression: schedule.cronExpression,
        timeZone: schedule.timeZone,
        isActive: schedule.isActive,
      });
      updatedCount += 1;
    } catch {
      failedCount += 1;
    }
  }

  return { updatedCount, failedCount };
}

/**
 * Enables or disables multiple triggers at once while preserving each trigger's cron and timezone.
 */
export async function bulkToggleTriggersActive(
  triggers: ProjectScheduledTrigger[],
  isActive: boolean
): Promise<{ updatedCount: number; failedCount: number }> {
  let updatedCount = 0;
  let failedCount = 0;

  for (const trigger of triggers) {
    if (!trigger.canEdit) {
      failedCount += 1;
      continue;
    }
    try {
      await scheduledTriggerService.updateScheduledTrigger(trigger.dataMart.id, trigger.id, {
        cronExpression: trigger.cronExpression,
        timeZone: trigger.timeZone,
        isActive,
      });
      updatedCount += 1;
    } catch {
      failedCount += 1;
    }
  }

  return { updatedCount, failedCount };
}

/**
 * Deletes multiple triggers at once.
 */
export async function bulkDeleteTriggers(
  triggers: ProjectScheduledTrigger[]
): Promise<{ deletedCount: number; failedCount: number }> {
  let deletedCount = 0;
  let failedCount = 0;

  for (const trigger of triggers) {
    if (!trigger.canDelete) {
      failedCount += 1;
      continue;
    }
    try {
      await scheduledTriggerService.deleteScheduledTrigger(trigger.dataMart.id, trigger.id);
      deletedCount += 1;
    } catch {
      failedCount += 1;
    }
  }

  return { deletedCount, failedCount };
}
