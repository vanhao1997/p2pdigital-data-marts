import { ScheduledTriggerType } from '../enums';
import type { ProjectScheduledTrigger } from '../model/scheduled-trigger.model';
import type { ScheduledReportRunConfig } from '../model/trigger-config.types';
import type {
  DiscoveredTriggerCluster,
  TriggerGroup,
  TriggerGroupMemberRef,
} from './trigger-group.model';

const STORAGE_KEY_PREFIX = 'owox:data-mart-trigger-groups:';

function getStorageKey(projectId: string): string {
  return `${STORAGE_KEY_PREFIX}${projectId || 'default'}`;
}

export function loadTriggerGroups(projectId: string): TriggerGroup[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(getStorageKey(projectId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is TriggerGroup =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as TriggerGroup).id === 'string' &&
        typeof (item as TriggerGroup).name === 'string' &&
        Array.isArray((item as TriggerGroup).dataMartIds) &&
        Array.isArray((item as TriggerGroup).triggerTypes)
    );
  } catch {
    return [];
  }
}

export function saveTriggerGroups(projectId: string, groups: TriggerGroup[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(getStorageKey(projectId), JSON.stringify(groups));
  } catch {
    // Ignore storage quota errors
  }
}

export function getTriggerReportId(trigger: ProjectScheduledTrigger): string | undefined {
  if (trigger.type !== ScheduledTriggerType.REPORT_RUN) return undefined;
  const config = trigger.triggerConfig as ScheduledReportRunConfig | undefined;
  return config?.reportId;
}

/**
 * Reconciles persisted TriggerGroups against the latest list of project triggers from the backend.
 * Links matching triggers by triggerId or by (dataMartId + type + reportId) so groups remain
 * accurate even when triggers are recreated or modified.
 */
export function reconcileTriggerGroupsWithTriggers(
  projectId: string,
  groups: TriggerGroup[],
  triggers: ProjectScheduledTrigger[]
): TriggerGroup[] {
  if (groups.length === 0) return groups;

  const triggerById = new Map(triggers.map(t => [t.id, t]));

  const nextGroups = groups.map(group => {
    const dataMartIdSet = new Set(group.dataMartIds);
    const typeSet = new Set(group.triggerTypes);
    const selectedReportSet = new Set(group.selectedReportIds);
    const nextRefs: TriggerGroupMemberRef[] = [];
    const seenTriggerIds = new Set<string>();

    // 1. Keep existing valid memberTriggerRefs that still exist in backend triggers
    for (const ref of group.memberTriggerRefs) {
      const existing = triggerById.get(ref.triggerId);
      if (existing && dataMartIdSet.has(existing.dataMart.id)) {
        seenTriggerIds.add(existing.id);
        nextRefs.push({
          triggerId: existing.id,
          dataMartId: existing.dataMart.id,
          type: existing.type,
          reportId: getTriggerReportId(existing),
        });
      }
    }

    // 2. Also link any backend triggers that belong to the group's dataMartIds + triggerTypes
    for (const trigger of triggers) {
      if (seenTriggerIds.has(trigger.id)) continue;
      if (!dataMartIdSet.has(trigger.dataMart.id)) continue;
      if (!typeSet.has(trigger.type)) continue;

      const reportId = getTriggerReportId(trigger);
      if (
        trigger.type === ScheduledTriggerType.REPORT_RUN &&
        group.reportSelectionMode === 'selected' &&
        selectedReportSet.size > 0 &&
        (!reportId || !selectedReportSet.has(reportId))
      ) {
        continue;
      }

      const hasSlotAlready = nextRefs.some(
        r =>
          r.dataMartId === trigger.dataMart.id &&
          r.type === trigger.type &&
          (trigger.type !== ScheduledTriggerType.REPORT_RUN || r.reportId === reportId)
      );

      if (
        !hasSlotAlready &&
        trigger.cronExpression === group.cronExpression &&
        trigger.timeZone === group.timeZone
      ) {
        seenTriggerIds.add(trigger.id);
        nextRefs.push({
          triggerId: trigger.id,
          dataMartId: trigger.dataMart.id,
          type: trigger.type,
          reportId,
        });
      }
    }

    if (
      nextRefs.length !== group.memberTriggerRefs.length ||
      nextRefs.some((ref, idx) => ref.triggerId !== group.memberTriggerRefs[idx]?.triggerId)
    ) {
      return {
        ...group,
        memberTriggerRefs: nextRefs,
      };
    }

    return group;
  });

  if (nextGroups.some((group, idx) => group !== groups[idx])) {
    saveTriggerGroups(projectId, nextGroups);
  }

  return nextGroups;
}

export function findTriggerGroupsForTrigger(
  groups: TriggerGroup[],
  trigger: ProjectScheduledTrigger
): TriggerGroup[] {
  return groups.filter(group =>
    group.memberTriggerRefs.some(ref => ref.triggerId === trigger.id)
  );
}

/**
 * Discovers clusters of ungrouped triggers across multiple Data Marts that share the exact
 * same cronExpression and timeZone, allowing 1-click grouping into a TriggerGroup.
 */
export function discoverSharedScheduleClusters(
  triggers: ProjectScheduledTrigger[],
  groups: TriggerGroup[]
): DiscoveredTriggerCluster[] {
  const groupedTriggerIds = new Set<string>();
  for (const group of groups) {
    for (const ref of group.memberTriggerRefs) {
      groupedTriggerIds.add(ref.triggerId);
    }
  }

  const clustersByKey = new Map<string, ProjectScheduledTrigger[]>();

  for (const trigger of triggers) {
    if (groupedTriggerIds.has(trigger.id)) continue;
    const key = `${trigger.cronExpression}__${trigger.timeZone}`;
    const list = clustersByKey.get(key) ?? [];
    list.push(trigger);
    clustersByKey.set(key, list);
  }

  const clusters: DiscoveredTriggerCluster[] = [];

  for (const [key, clusterTriggers] of clustersByKey.entries()) {
    const uniqueDataMartsMap = new Map<string, { id: string; title: string }>();
    const uniqueTypes = new Set<ScheduledTriggerType>();

    for (const trigger of clusterTriggers) {
      uniqueDataMartsMap.set(trigger.dataMart.id, {
        id: trigger.dataMart.id,
        title: trigger.dataMart.title,
      });
      uniqueTypes.add(trigger.type);
    }

    // Only suggest a group when at least 2 distinct Data Marts share the schedule
    if (uniqueDataMartsMap.size >= 2) {
      clusters.push({
        key,
        cronExpression: clusterTriggers[0].cronExpression,
        timeZone: clusterTriggers[0].timeZone,
        triggerTypes: Array.from(uniqueTypes),
        dataMarts: Array.from(uniqueDataMartsMap.values()),
        triggers: clusterTriggers,
      });
    }
  }

  return clusters;
}
