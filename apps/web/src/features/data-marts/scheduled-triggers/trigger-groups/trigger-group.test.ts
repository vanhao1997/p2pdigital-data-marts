import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DataDestinationType } from '../../../data-destination';
import { DataMartDefinitionType, DataMartStatus } from '../../shared';
import { ScheduledTriggerType, TRIGGER_CONFIG_TYPES } from '../enums';
import type { ProjectScheduledTrigger } from '../model/scheduled-trigger.model';
import { scheduledTriggerService } from '../services';
import {
  bulkDeleteTriggers,
  bulkToggleTriggersActive,
  bulkUpdateTriggersSchedule,
  deleteTriggerGroupOnBackend,
  syncTriggerGroupWithBackend,
  toggleTriggerGroupActiveOnBackend,
} from './trigger-group-sync.service';
import {
  discoverSharedScheduleClusters,
  findTriggerGroupsForTrigger,
  loadTriggerGroups,
  reconcileTriggerGroupsWithTriggers,
  saveTriggerGroups,
} from './trigger-group.storage';

vi.mock('../services', () => ({
  scheduledTriggerService: {
    createScheduledTrigger: vi.fn(),
    updateScheduledTrigger: vi.fn(),
    deleteScheduledTrigger: vi.fn(),
  },
}));

describe('Trigger Group Storage & Discovery', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('discovers shared schedule clusters when >= 2 Data Marts share cron and timezone', () => {
    const triggers: ProjectScheduledTrigger[] = [
      buildMockTrigger({ id: 't1', dataMartId: 'dm-1', dataMartTitle: 'Ads Facebook' }),
      buildMockTrigger({ id: 't2', dataMartId: 'dm-2', dataMartTitle: 'Ads Google' }),
      buildMockTrigger({
        id: 't3',
        dataMartId: 'dm-3',
        dataMartTitle: 'CRM Orders',
        cronExpression: '0 12 * * *',
      }),
    ];

    const clusters = discoverSharedScheduleClusters(triggers, []);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].dataMarts.map(d => d.id)).toEqual(['dm-1', 'dm-2']);
    expect(clusters[0].triggers).toHaveLength(2);
  });

  it('reconciles persisted TriggerGroup member refs against backend triggers', () => {
    const triggers: ProjectScheduledTrigger[] = [
      buildMockTrigger({
        id: 't-new',
        dataMartId: 'dm-1',
        dataMartTitle: 'Ads Facebook',
        type: ScheduledTriggerType.CONNECTOR_RUN,
        cronExpression: '0 9 * * *',
        timeZone: 'UTC',
      }),
    ];

    saveTriggerGroups('proj-1', [
      {
        id: 'grp-1',
        projectId: 'proj-1',
        name: 'Morning Sync',
        dataMartIds: ['dm-1'],
        triggerTypes: [ScheduledTriggerType.CONNECTOR_RUN],
        reportSelectionMode: 'all',
        selectedReportIds: [],
        cronExpression: '0 9 * * *',
        timeZone: 'UTC',
        isActive: true,
        memberTriggerRefs: [
          {
            triggerId: 't-deleted',
            dataMartId: 'dm-1',
            type: ScheduledTriggerType.CONNECTOR_RUN,
          },
        ],
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
      },
    ]);

    const reconciled = reconcileTriggerGroupsWithTriggers(
      'proj-1',
      loadTriggerGroups('proj-1'),
      triggers
    );

    expect(reconciled[0].memberTriggerRefs).toEqual([
      {
        triggerId: 't-new',
        dataMartId: 'dm-1',
        type: ScheduledTriggerType.CONNECTOR_RUN,
        reportId: undefined,
      },
    ]);
    expect(findTriggerGroupsForTrigger(reconciled, triggers[0])).toHaveLength(1);
  });
});

describe('Trigger Group Backend Sync & Bulk Operations', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('creates and updates CONNECTOR_RUN, DATA_QUALITY_RUN, and REPORT_RUN triggers across a Data Mart group', async () => {
    const existingConnectorTrigger = buildMockTrigger({
      id: 'existing-conn-1',
      dataMartId: 'dm-1',
      type: ScheduledTriggerType.CONNECTOR_RUN,
    });

    vi.mocked(scheduledTriggerService.updateScheduledTrigger).mockResolvedValue({
      id: 'existing-conn-1',
    } as never);

    let createdCounter = 0;
    vi.mocked(scheduledTriggerService.createScheduledTrigger).mockImplementation(async () => {
      createdCounter += 1;
      return { id: `created-${createdCounter}` } as never;
    });

    const result = await syncTriggerGroupWithBackend({
      projectId: 'proj-1',
      draft: {
        name: 'Bộ Trigger Marketing',
        description: 'Đồng bộ chung 8h sáng',
        dataMartIds: ['dm-1', 'dm-2'],
        triggerTypes: [
          ScheduledTriggerType.CONNECTOR_RUN,
          ScheduledTriggerType.DATA_QUALITY_RUN,
          ScheduledTriggerType.REPORT_RUN,
        ],
        reportSelectionMode: 'all',
        selectedReportIds: [],
        cronExpression: '0 8 * * *',
        timeZone: 'Asia/Ho_Chi_Minh',
        isActive: true,
      },
      existingTriggers: [existingConnectorTrigger],
      dataMarts: [
        {
          id: 'dm-1',
          title: 'Facebook Ads',
          status: DataMartStatus.PUBLISHED,
          definitionType: DataMartDefinitionType.CONNECTOR,
          connectorSourceName: 'FacebookMarketing',
          triggersCount: 1,
          reportsCount: 1,
          createdByUser: null,
          createdAt: new Date(),
          modifiedAt: new Date(),
          storage: {} as never,
        },
        {
          id: 'dm-2',
          title: 'Google Ads SQL',
          status: DataMartStatus.PUBLISHED,
          definitionType: DataMartDefinitionType.SQL,
          connectorSourceName: null,
          triggersCount: 0,
          reportsCount: 1,
          createdByUser: null,
          createdAt: new Date(),
          modifiedAt: new Date(),
          storage: {} as never,
        },
      ],
      reports: [
        {
          id: 'rep-1',
          title: 'Báo cáo Facebook',
          dataMart: { id: 'dm-1', title: 'Facebook Ads' } as never,
          dataDestinationAccess: { type: DataDestinationType.GOOGLE_SHEETS } as never,
        } as never,
        {
          id: 'rep-looker',
          title: 'Looker Studio Pull',
          dataMart: { id: 'dm-2', title: 'Google Ads SQL' } as never,
          dataDestinationAccess: { type: DataDestinationType.LOOKER_STUDIO } as never,
        } as never,
      ],
    });

    // dm-1: updates CONNECTOR_RUN (1), creates DATA_QUALITY_RUN (1), creates REPORT_RUN for rep-1 (1)
    // dm-2: skips CONNECTOR_RUN (SQL mart), creates DATA_QUALITY_RUN (1), skips REPORT_RUN (only Looker Studio report)
    expect(result.updatedCount).toBe(1);
    expect(result.createdCount).toBe(3);
    expect(result.group.memberTriggerRefs).toHaveLength(4);
    expect(loadTriggerGroups('proj-1')).toHaveLength(1);
  });

  it('toggles and deletes a TriggerGroup along with its member triggers', async () => {
    vi.mocked(scheduledTriggerService.updateScheduledTrigger).mockResolvedValue({} as never);
    vi.mocked(scheduledTriggerService.deleteScheduledTrigger).mockResolvedValue(undefined);

    const group = {
      id: 'grp-1',
      projectId: 'proj-1',
      name: 'Group 1',
      dataMartIds: ['dm-1', 'dm-2'],
      triggerTypes: [ScheduledTriggerType.DATA_QUALITY_RUN],
      reportSelectionMode: 'all' as const,
      selectedReportIds: [],
      cronExpression: '0 9 * * *',
      timeZone: 'UTC',
      isActive: true,
      memberTriggerRefs: [
        { triggerId: 't-1', dataMartId: 'dm-1', type: ScheduledTriggerType.DATA_QUALITY_RUN },
        { triggerId: 't-2', dataMartId: 'dm-2', type: ScheduledTriggerType.DATA_QUALITY_RUN },
      ],
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
    };
    saveTriggerGroups('proj-1', [group]);

    const toggleRes = await toggleTriggerGroupActiveOnBackend('proj-1', group, false, []);
    expect(toggleRes.updatedCount).toBe(2);
    expect(loadTriggerGroups('proj-1')[0].isActive).toBe(false);

    const deleteRes = await deleteTriggerGroupOnBackend('proj-1', group, true);
    expect(deleteRes.deletedCount).toBe(2);
    expect(loadTriggerGroups('proj-1')).toHaveLength(0);
  });

  it('supports bulk schedule update, bulk toggle, and bulk delete', async () => {
    vi.mocked(scheduledTriggerService.updateScheduledTrigger).mockResolvedValue({} as never);
    vi.mocked(scheduledTriggerService.deleteScheduledTrigger).mockResolvedValue(undefined);

    const triggers = [
      buildMockTrigger({ id: 't-1', dataMartId: 'dm-1' }),
      buildMockTrigger({ id: 't-2', dataMartId: 'dm-2' }),
    ];

    const scheduleRes = await bulkUpdateTriggersSchedule(triggers, {
      cronExpression: '0 6 * * *',
      timeZone: 'UTC',
      isActive: true,
    });
    expect(scheduleRes.updatedCount).toBe(2);

    const toggleRes = await bulkToggleTriggersActive(triggers, false);
    expect(toggleRes.updatedCount).toBe(2);

    const deleteRes = await bulkDeleteTriggers(triggers);
    expect(deleteRes.deletedCount).toBe(2);
  });
});

function buildMockTrigger(
  overrides: {
    id?: string;
    dataMartId?: string;
    dataMartTitle?: string;
    type?: ScheduledTriggerType;
    cronExpression?: string;
    timeZone?: string;
  } = {}
): ProjectScheduledTrigger {
  return {
    id: overrides.id ?? 'trigger-1',
    type: overrides.type ?? ScheduledTriggerType.REPORT_RUN,
    cronExpression: overrides.cronExpression ?? '0 9 * * *',
    timeZone: overrides.timeZone ?? 'UTC',
    isActive: true,
    nextRun: new Date('2026-06-06T09:00:00.000Z'),
    lastRun: null,
    triggerConfig: {
      type: TRIGGER_CONFIG_TYPES.SCHEDULED_REPORT_RUN,
      reportId: 'report-1',
    } as never,
    createdById: 'user-1',
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    modifiedAt: new Date('2026-06-01T00:00:00.000Z'),
    createdByUser: null,
    dataMart: {
      id: overrides.dataMartId ?? 'dm-1',
      title: overrides.dataMartTitle ?? 'Marketing Mart',
    },
    canEdit: true,
    canDelete: true,
  };
}
