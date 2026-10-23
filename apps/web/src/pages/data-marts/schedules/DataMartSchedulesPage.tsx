import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@owox/ui/components/badge';
import { Button } from '@owox/ui/components/button';
import RelativeTime from '@owox/ui/components/common/relative-time';
import { SkeletonList } from '@owox/ui/components/common/skeleton-list';
import { Layers, Plus } from 'lucide-react';
import { extractApiError } from '../../../app/api';
import { ConnectorContextProvider } from '../../../features/connectors/shared/model/context';
import { useConnector } from '../../../features/connectors/shared/model/hooks/useConnector';
import type { ConnectorListItem } from '../../../features/connectors/shared/model/types/connector';
import { DataMartContext } from '../../../features/data-marts/edit/model/context/context';
import { ScheduledTriggerType } from '../../../features/data-marts/scheduled-triggers/enums';
import { ScheduleDisplay } from '../../../features/data-marts/scheduled-triggers/components/ScheduleDisplay/ScheduleDisplay';
import { ScheduledTriggerActionsCell } from '../../../features/data-marts/scheduled-triggers/components/ScheduledTriggerTable/ScheduledTriggerActionsCell';
import { ScheduledTriggerRunTarget } from '../../../features/data-marts/scheduled-triggers/components/ScheduledTriggerTable/ScheduledTriggerRunTarget';
import { ScheduledTriggerMapper } from '../../../features/data-marts/scheduled-triggers/model/mappers';
import type { ProjectScheduledTrigger } from '../../../features/data-marts/scheduled-triggers/model/scheduled-trigger.model';
import type {
  ScheduledConnectorRunConfig,
  ScheduledReportRunConfig,
} from '../../../features/data-marts/scheduled-triggers/model/trigger-config.types';
import { scheduledTriggerService } from '../../../features/data-marts/scheduled-triggers/services';
import {
  ScheduledTriggerColumnKey,
  ScheduledTriggerColumnLabels,
} from '../../../features/data-marts/scheduled-triggers/components/ScheduledTriggerTable/columns';
import {
  ScheduledTriggerBulkActions,
  TriggerGroupFormSheet,
  TriggerGroupsSection,
  discoverSharedScheduleClusters,
  findTriggerGroupsForTrigger,
  loadTriggerGroups,
  reconcileTriggerGroupsWithTriggers,
  type TriggerGroup,
  type TriggerGroupDraft,
} from '../../../features/data-marts/scheduled-triggers/trigger-groups';
import { StatusLabel, StatusTypeEnum } from '../../../shared/components/StatusLabel';
import {
  BaseTable,
  SortableHeader,
  TableSelectionCheckbox,
  ToggleColumnsHeader,
} from '../../../shared/components/Table';
import {
  applyFiltersToData,
  type FilterAccessors,
  type FilterConfigItem,
} from '../../../shared/components/TableFilters';
import { collectOptionsFromData } from '../../../shared/components/TableFilters/collectOptions.utils';
import { UserReference } from '../../../shared/components/UserReference';
import { useBaseTable, usePersistentFilters, useProjectRoute } from '../../../shared/hooks';
import { isVietnameseLocale } from '../../../shared/utils/field-humanizer';
import { ProjectDataMartTableFilters } from '../shared/ProjectDataMartTableFilters';
import { ProjectDataMartTableSearch } from '../shared/ProjectDataMartTableSearch';
import {
  buildProjectTableUserLabelMapper,
  matchesProjectTableSearch,
} from '../shared/ProjectDataMartTableFilters.utils';
import { buildProjectDataMartContextValue } from '../shared/projectDataMartContext';
import { ProjectDataMartEmptyState } from '../shared/ProjectDataMartEmptyState';
import { ProjectDataMartTitleLink } from '../shared/ProjectDataMartTitleLink';
import { ProjectScheduledTriggerEditSheet } from './ProjectScheduledTriggerEditSheet';
import { getScheduledTriggerTypeLabel } from '../../../features/data-marts/scheduled-triggers/utils/scheduled-trigger-labels';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

const DATA_MART_SCHEDULES_PAGE_SIZE = 15;
const PROJECT_SCHEDULED_TRIGGERS_TABLE_ID = 'project-scheduled-triggers-table';

type ProjectScheduledTriggerFilterKey =
  | 'dataMart'
  | 'triggerType'
  | 'runTarget'
  | 'triggerStatus'
  | 'createdBy';

function buildProjectScheduledTriggerFilterAccessors(
  connectors: ConnectorListItem[],
  t: TFunction
): FilterAccessors<ProjectScheduledTriggerFilterKey, ProjectScheduledTrigger> {
  return {
    dataMart: row => row.dataMart.title,
    triggerType: row => row.type,
    runTarget: row => getScheduledTriggerRunTargetTitle(row, connectors, t),
    triggerStatus: row => String(row.isActive),
    createdBy: row => row.createdByUser?.userId,
  };
}

function getScheduledTriggerRunTargetTitle(
  trigger: ProjectScheduledTrigger,
  connectors: ConnectorListItem[] = [],
  t: TFunction = ((_key: string, fallback?: string) => fallback ?? '') as TFunction
) {
  if (trigger.type === ScheduledTriggerType.REPORT_RUN) {
    const config = trigger.triggerConfig as ScheduledReportRunConfig | undefined;
    return config?.report?.title ?? config?.reportId ?? t('scheduledTriggerUi.report', 'Report');
  }
  if (trigger.type === ScheduledTriggerType.DATA_QUALITY_RUN) {
    return t('scheduledTriggerUi.qualityChecks', 'Data Quality checks');
  }

  const config = trigger.triggerConfig as ScheduledConnectorRunConfig | undefined;
  const connectorSourceName = config?.connector?.connector.source.name;
  const connector = connectors.find(item => item.name === connectorSourceName);
  return (
    connector?.displayName ??
    config?.connector?.connector.info?.displayName ??
    connectorSourceName ??
    t('scheduledTriggerUi.connector', 'Connector')
  );
}

function buildProjectScheduledTriggerFilters(
  data: ProjectScheduledTrigger[],
  connectors: ConnectorListItem[],
  t: TFunction
): FilterConfigItem<ProjectScheduledTriggerFilterKey>[] {
  const filterAccessors = buildProjectScheduledTriggerFilterAccessors(connectors, t);
  const userLabelMapper = buildProjectTableUserLabelMapper(
    data.map(trigger => trigger.createdByUser)
  );

  return [
    {
      id: 'dataMart',
      label: t('search.labelDataMart'),
      dataType: 'string',
      operators: ['contains', 'not_contains', 'eq', 'neq'],
      options: collectOptionsFromData(data, filterAccessors.dataMart),
    },
    {
      id: 'triggerType',
      label: t('projectDataMartPages.triggerTypeLabel'),
      dataType: 'enum',
      operators: ['eq', 'neq'],
      options: collectOptionsFromData(data, filterAccessors.triggerType, {
        labelMapper: getScheduledTriggerTypeLabel,
      }),
    },
    {
      id: 'runTarget',
      label: t('projectDataMartPages.runTargetLabel'),
      dataType: 'string',
      operators: ['contains', 'not_contains', 'eq', 'neq'],
      options: collectOptionsFromData(data, filterAccessors.runTarget),
    },
    {
      id: 'triggerStatus',
      label: t('projectDataMartPages.triggerStatusLabel'),
      dataType: 'enum',
      operators: ['eq', 'neq'],
      options: collectOptionsFromData(data, filterAccessors.triggerStatus, {
        labelMapper: value =>
          value === 'true' ? t('common.active') : t('projectDataMartPages.disabled'),
      }),
    },
    {
      id: 'createdBy',
      label: t('common.createdBy'),
      dataType: 'enum',
      operators: ['eq', 'neq'],
      options: collectOptionsFromData(data, filterAccessors.createdBy, {
        labelMapper: userLabelMapper,
      }),
    },
  ];
}

function DataMartSchedulesPageContent() {
  const { t } = useTranslation();
  const isVi = isVietnameseLocale();
  const { projectId = '' } = useParams<{ projectId: string }>();
  const { scope } = useProjectRoute();
  const { connectors, fetchAvailableConnectors } = useConnector();
  const [triggers, setTriggers] = useState<ProjectScheduledTrigger[]>([]);
  const [triggerGroups, setTriggerGroups] = useState<TriggerGroup[]>([]);
  const [activeGroupFilterId, setActiveGroupFilterId] = useState<string | null>(null);
  const [isGroupSheetOpen, setIsGroupSheetOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<TriggerGroup | null>(null);
  const [initialGroupDraft, setInitialGroupDraft] = useState<
    Partial<TriggerGroupDraft> | undefined
  >(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingTrigger, setEditingTrigger] = useState<ProjectScheduledTrigger | null>(null);

  const loadTriggers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await scheduledTriggerService.getProjectScheduledTriggers();
      const mapped = ScheduledTriggerMapper.mapProjectFromDtoList(response);
      setTriggers(mapped);
      const storedGroups = loadTriggerGroups(projectId);
      setTriggerGroups(reconcileTriggerGroupsWithTriggers(projectId, storedGroups, mapped));
    } catch (caught) {
      setError(
        extractApiError(caught).message ??
          t('projectDataMartPages.loadTriggersFailed', 'Failed to fetch Data Mart triggers')
      );
    } finally {
      setIsLoading(false);
    }
  }, [projectId, t]);

  useEffect(() => {
    void loadTriggers();
  }, [loadTriggers]);

  useEffect(() => {
    void fetchAvailableConnectors();
  }, [fetchAvailableConnectors]);

  const handleCloseTriggerEditSheet = useCallback(() => {
    setEditingTrigger(null);
  }, []);

  const handleTriggerSaved = useCallback(async () => {
    await loadTriggers();
  }, [loadTriggers]);

  const handleOpenCreateGroup = useCallback((draft?: Partial<TriggerGroupDraft>) => {
    setEditingGroup(null);
    setInitialGroupDraft(draft);
    setIsGroupSheetOpen(true);
  }, []);

  const handleOpenEditGroup = useCallback((group: TriggerGroup) => {
    setInitialGroupDraft(undefined);
    setEditingGroup(group);
    setIsGroupSheetOpen(true);
  }, []);

  const handleCloseGroupSheet = useCallback(() => {
    setIsGroupSheetOpen(false);
    setEditingGroup(null);
    setInitialGroupDraft(undefined);
  }, []);

  const handleDeleteTrigger = useCallback(
    async (trigger: ProjectScheduledTrigger) => {
      await scheduledTriggerService.deleteScheduledTrigger(trigger.dataMart.id, trigger.id);
      await loadTriggers();
    },
    [loadTriggers]
  );

  const discoveredClusters = useMemo(
    () => discoverSharedScheduleClusters(triggers, triggerGroups),
    [triggerGroups, triggers]
  );

  const dataMartTitlesById = useMemo(() => {
    const map = new Map<string, string>();
    for (const trigger of triggers) {
      map.set(trigger.dataMart.id, trigger.dataMart.title);
    }
    return map;
  }, [triggers]);

  const filterAccessors = useMemo(
    () => buildProjectScheduledTriggerFilterAccessors(connectors, t),
    [connectors, t]
  );

  const filtersConfig = useMemo(
    () => buildProjectScheduledTriggerFilters(triggers, connectors, t),
    [connectors, t, triggers]
  );

  const translatedColumnLabels = useMemo(
    () => ({
      [ScheduledTriggerColumnKey.TYPE]: t(
        'scheduledTriggerUi.columns.triggerType',
        ScheduledTriggerColumnLabels[ScheduledTriggerColumnKey.TYPE]
      ),
      [ScheduledTriggerColumnKey.TRIGGER_CONFIG]: t(
        'scheduledTriggerUi.columns.runTarget',
        ScheduledTriggerColumnLabels[ScheduledTriggerColumnKey.TRIGGER_CONFIG]
      ),
      [ScheduledTriggerColumnKey.CRON_EXPRESSION]: t(
        'scheduledTriggerUi.columns.schedule',
        ScheduledTriggerColumnLabels[ScheduledTriggerColumnKey.CRON_EXPRESSION]
      ),
      [ScheduledTriggerColumnKey.NEXT_RUN]: t(
        'scheduledTriggerUi.columns.nextRun',
        ScheduledTriggerColumnLabels[ScheduledTriggerColumnKey.NEXT_RUN]
      ),
      [ScheduledTriggerColumnKey.LAST_RUN]: t(
        'scheduledTriggerUi.columns.lastRun',
        ScheduledTriggerColumnLabels[ScheduledTriggerColumnKey.LAST_RUN]
      ),
      [ScheduledTriggerColumnKey.IS_ACTIVE]: t(
        'scheduledTriggerUi.columns.triggerStatus',
        ScheduledTriggerColumnLabels[ScheduledTriggerColumnKey.IS_ACTIVE]
      ),
      [ScheduledTriggerColumnKey.CREATED_BY]: t(
        'scheduledTriggerUi.columns.createdBy',
        ScheduledTriggerColumnLabels[ScheduledTriggerColumnKey.CREATED_BY]
      ),
    }),
    [t]
  );

  const { appliedState, apply, clear } = usePersistentFilters<ProjectScheduledTriggerFilterKey>({
    projectId,
    tableId: PROJECT_SCHEDULED_TRIGGERS_TABLE_ID,
    urlParam: 'filters',
    config: filtersConfig,
  });

  const filteredTriggers = useMemo(
    () =>
      applyFiltersToData<ProjectScheduledTriggerFilterKey, ProjectScheduledTrigger>(
        triggers,
        appliedState,
        filterAccessors
      ),
    [appliedState, filterAccessors, triggers]
  );

  const searchedTriggers = useMemo(
    () =>
      filteredTriggers.filter(trigger => {
        if (activeGroupFilterId) {
          const activeGroup = triggerGroups.find(g => g.id === activeGroupFilterId);
          if (
            activeGroup &&
            !activeGroup.memberTriggerRefs.some(ref => ref.triggerId === trigger.id) &&
            !activeGroup.dataMartIds.includes(trigger.dataMart.id)
          ) {
            return false;
          }
        }
        const belongingGroups = findTriggerGroupsForTrigger(triggerGroups, trigger);
        return matchesProjectTableSearch(searchQuery, [
          trigger.dataMart.title,
          ...belongingGroups.map(g => g.name),
          getScheduledTriggerTypeLabel(trigger.type),
          getScheduledTriggerRunTargetTitle(trigger, connectors, t),
          trigger.cronExpression,
          trigger.isActive
            ? t('common.active', 'Active')
            : t('projectDataMartPages.disabled', 'Disabled'),
          trigger.createdByUser?.fullName,
          trigger.createdByUser?.email,
        ]);
      }),
    [activeGroupFilterId, connectors, filteredTriggers, searchQuery, t, triggerGroups]
  );

  const columns = useMemo<ColumnDef<ProjectScheduledTrigger>[]>(
    () => [
      {
        id: 'select',
        size: 40,
        enableResizing: false,
        enableSorting: false,
        enableHiding: false,
        header: ({ table }) => (
          <TableSelectionCheckbox
            checked={table.getIsAllPageRowsSelected()}
            ariaLabel={t('dataMartsPage.selectAllRows', 'Select all rows on this page')}
            onClick={table.getToggleAllPageRowsSelectedHandler()}
            extendedHitArea
          />
        ),
        cell: ({ row }) => (
          <TableSelectionCheckbox
            checked={row.getIsSelected()}
            ariaLabel={t('dataMartsPage.selectRow', 'Select row')}
            onClick={row.getToggleSelectedHandler()}
            extendedHitArea
          />
        ),
      },
      {
        id: 'dataMart',
        accessorFn: row => row.dataMart.title,
        meta: { title: t('search.labelDataMart') },
        size: 260,
        header: ({ column }) => (
          <SortableHeader column={column}>{t('search.labelDataMart')}</SortableHeader>
        ),
        cell: ({ row }) => {
          const belongingGroups = findTriggerGroupsForTrigger(triggerGroups, row.original);
          return (
            <div className='space-y-1'>
              <ProjectDataMartTitleLink
                to={scope(`/data-marts/${row.original.dataMart.id}/triggers`)}
                title={row.original.dataMart.title}
              />
              {belongingGroups.length > 0 && (
                <div className='flex flex-wrap gap-1'>
                  {belongingGroups.map(group => (
                    <button
                      key={group.id}
                      type='button'
                      data-trigger-group-badge='true'
                      onClick={e => {
                        e.stopPropagation();
                        handleOpenEditGroup(group);
                      }}
                      className='border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors'
                      title={
                        isVi
                          ? `Thuộc Bộ Trigger: ${group.name} (Nhấn để chỉnh sửa nhóm)`
                          : `Part of Trigger Group: ${group.name} (Click to edit group)`
                      }
                    >
                      <Layers className='h-2.5 w-2.5' />
                      <span>{group.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: ScheduledTriggerColumnKey.TYPE,
        meta: { title: translatedColumnLabels[ScheduledTriggerColumnKey.TYPE] },
        size: 170,
        header: ({ column }) => (
          <SortableHeader column={column}>
            {translatedColumnLabels[ScheduledTriggerColumnKey.TYPE]}
          </SortableHeader>
        ),
        cell: ({ row }) => {
          const label = getScheduledTriggerTypeLabel(row.original.type);
          return <Badge variant='outline'>{label}</Badge>;
        },
      },
      {
        accessorKey: ScheduledTriggerColumnKey.TRIGGER_CONFIG,
        meta: { title: translatedColumnLabels[ScheduledTriggerColumnKey.TRIGGER_CONFIG] },
        size: 220,
        header: ({ column }) => (
          <SortableHeader column={column}>
            {translatedColumnLabels[ScheduledTriggerColumnKey.TRIGGER_CONFIG]}
          </SortableHeader>
        ),
        cell: ({ row }) => (
          <DataMartContext.Provider value={buildProjectDataMartContextValue(row.original.dataMart)}>
            <ScheduledTriggerRunTarget trigger={row.original} />
          </DataMartContext.Provider>
        ),
      },
      {
        accessorKey: ScheduledTriggerColumnKey.CRON_EXPRESSION,
        meta: { title: translatedColumnLabels[ScheduledTriggerColumnKey.CRON_EXPRESSION] },
        size: 190,
        header: ({ column }) => (
          <SortableHeader column={column}>
            {translatedColumnLabels[ScheduledTriggerColumnKey.CRON_EXPRESSION]}
          </SortableHeader>
        ),
        cell: ({ row }) => (
          <ScheduleDisplay
            cronExpression={row.original.cronExpression}
            timeZone={row.original.timeZone}
            isEnabled={row.original.isActive}
          />
        ),
      },
      {
        accessorKey: ScheduledTriggerColumnKey.NEXT_RUN,
        meta: { title: translatedColumnLabels[ScheduledTriggerColumnKey.NEXT_RUN] },
        size: 160,
        header: ({ column }) => (
          <SortableHeader column={column}>
            {translatedColumnLabels[ScheduledTriggerColumnKey.NEXT_RUN]}
          </SortableHeader>
        ),
        cell: ({ row }) => (
          <div className='text-muted-foreground text-sm'>
            {row.original.nextRun ? (
              <RelativeTime date={row.original.nextRun} />
            ) : (
              t('projectDataMartPages.notScheduled')
            )}
          </div>
        ),
      },
      {
        accessorKey: ScheduledTriggerColumnKey.LAST_RUN,
        meta: { title: translatedColumnLabels[ScheduledTriggerColumnKey.LAST_RUN] },
        size: 150,
        header: ({ column }) => (
          <SortableHeader column={column}>
            {translatedColumnLabels[ScheduledTriggerColumnKey.LAST_RUN]}
          </SortableHeader>
        ),
        cell: ({ row }) => (
          <div className='text-sm'>
            {row.original.lastRun ? (
              <RelativeTime date={row.original.lastRun} />
            ) : (
              <span className='text-muted-foreground text-sm'>
                {t('projectDataMartPages.neverRun')}
              </span>
            )}
          </div>
        ),
      },
      {
        accessorKey: ScheduledTriggerColumnKey.IS_ACTIVE,
        meta: { title: translatedColumnLabels[ScheduledTriggerColumnKey.IS_ACTIVE] },
        size: 150,
        header: ({ column }) => (
          <SortableHeader column={column}>
            {translatedColumnLabels[ScheduledTriggerColumnKey.IS_ACTIVE]}
          </SortableHeader>
        ),
        cell: ({ row }) => (
          <StatusLabel
            type={row.original.isActive ? StatusTypeEnum.SUCCESS : StatusTypeEnum.NEUTRAL}
            variant='ghost'
            showIcon={false}
          >
            {row.original.isActive ? t('common.active') : t('projectDataMartPages.disabled')}
          </StatusLabel>
        ),
      },
      {
        id: ScheduledTriggerColumnKey.CREATED_BY,
        accessorFn: row => row.createdByUser?.fullName ?? row.createdByUser?.email,
        meta: { title: translatedColumnLabels[ScheduledTriggerColumnKey.CREATED_BY] },
        size: 180,
        header: ({ column }) => (
          <SortableHeader column={column}>
            {translatedColumnLabels[ScheduledTriggerColumnKey.CREATED_BY]}
          </SortableHeader>
        ),
        cell: ({ row }) => {
          const user = row.original.createdByUser;
          if (!user) return <span className='text-muted-foreground'>-</span>;
          return <UserReference userProjection={user} />;
        },
      },
      {
        id: 'actions',
        size: 80,
        enableResizing: false,
        enableSorting: false,
        header: ({ table }) => <ToggleColumnsHeader table={table} />,
        cell: ({ row }) => (
          <ScheduledTriggerActionsCell
            trigger={row.original}
            canEdit={row.original.canEdit}
            canDelete={row.original.canDelete}
            onEditTrigger={() => {
              setEditingTrigger(row.original);
            }}
            onDeleteTrigger={() => {
              void handleDeleteTrigger(row.original);
            }}
          />
        ),
      },
    ],
    [handleDeleteTrigger, handleOpenEditGroup, isVi, scope, t, translatedColumnLabels, triggerGroups]
  );

  const { table } = useBaseTable<ProjectScheduledTrigger>({
    data: searchedTriggers,
    columns,
    storageKeyPrefix: 'project-data-mart-scheduled-triggers',
    defaultSortingColumn: ScheduledTriggerColumnKey.NEXT_RUN,
    defaultPageSize: DATA_MART_SCHEDULES_PAGE_SIZE,
    enableRowSelection: true,
    getRowId: row => row.id,
  });

  const selectedRows = table.getSelectedRowModel().flatRows;
  const hasSelectedRows = selectedRows.length > 0;

  return (
    <div className='dm-page' data-testid='dataMartSchedulesPage'>
      <header className='dm-page-header flex flex-wrap items-center justify-between gap-3'>
        <h1 className='dm-page-header-title'>{t('projectDataMartPages.triggersTitle')}</h1>
        <Button
          type='button'
          variant='default'
          size='sm'
          onClick={() => {
            handleOpenCreateGroup();
          }}
          data-testid='createTriggerGroupBtn'
        >
          <Layers className='h-4 w-4' />
          <span>
            {isVi
              ? 'Tạo Bộ Trigger nhóm'
              : 'Create Trigger Group'}
          </span>
        </Button>
      </header>

      <div className='dm-page-content'>
        {isLoading ? (
          <SkeletonList />
        ) : error ? (
          <div className='dm-card-block text-destructive text-sm'>{error}</div>
        ) : (
          <>
            <TriggerGroupsSection
              projectId={projectId}
              groups={triggerGroups}
              discoveredClusters={discoveredClusters}
              triggers={triggers}
              dataMartTitlesById={dataMartTitlesById}
              activeGroupFilterId={activeGroupFilterId}
              onSelectGroupFilter={setActiveGroupFilterId}
              onRequestCreateGroup={handleOpenCreateGroup}
              onRequestEditGroup={handleOpenEditGroup}
              onGroupsChanged={loadTriggers}
            />

            {triggers.length === 0 ? (
              <div className='dm-card'>
                <ProjectDataMartEmptyState variant='triggers' />
              </div>
            ) : (
              <div className='dm-card' data-testid='projectScheduledTriggersTable'>
                <BaseTable
                  tableId={PROJECT_SCHEDULED_TRIGGERS_TABLE_ID}
                  table={table}
                  ariaLabel={t('projectDataMartPages.triggersTitle')}
                  paginationProps={{ displaySelected: false }}
                  renderToolbarLeft={tableInstance => (
                    <>
                      {hasSelectedRows && (
                        <div className='mr-2 flex items-center gap-2 border-r pr-4'>
                          <ScheduledTriggerBulkActions
                            selectedTriggers={selectedRows.map(row => row.original)}
                            onCompleted={loadTriggers}
                            onClearSelection={() => {
                              tableInstance.resetRowSelection();
                            }}
                            onGroupSelectedTriggers={draft => {
                              handleOpenCreateGroup(draft);
                            }}
                          />
                        </div>
                      )}
                      <ProjectDataMartTableFilters
                        appliedState={appliedState}
                        config={filtersConfig}
                        onApply={apply}
                        onClear={clear}
                      />
                      <ProjectDataMartTableSearch value={searchQuery} onChange={setSearchQuery} />
                    </>
                  )}
                  renderToolbarRight={() => (
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      onClick={() => {
                        handleOpenCreateGroup();
                      }}
                      data-testid='toolbarCreateTriggerGroupBtn'
                    >
                      <Plus className='h-4 w-4' />
                      <span className='hidden sm:inline'>
                        {isVi ? 'Bộ Trigger nhóm mới' : 'New Trigger Group'}
                      </span>
                    </Button>
                  )}
                  renderEmptyState={() => (
                    <div
                      className='flex h-32 items-center justify-center text-center'
                      role='status'
                      aria-live='polite'
                    >
                      {t('projectDataMartPages.noTriggersForAccessible')}
                    </div>
                  )}
                  onRowClick={(row, e) => {
                    if (
                      e.target instanceof HTMLElement &&
                      (e.target.closest('[role="checkbox"]') ||
                        e.target.closest('[data-trigger-group-badge="true"]') ||
                        e.target.closest('.actions-cell') ||
                        e.target.closest('[role="menuitem"]') ||
                        e.target.closest('[data-state="open"]'))
                    ) {
                      return;
                    }
                    if (row.original.canEdit) {
                      setEditingTrigger(row.original);
                    }
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>

      <ProjectScheduledTriggerEditSheet
        trigger={editingTrigger}
        isOpen={editingTrigger !== null}
        onClose={handleCloseTriggerEditSheet}
        onSaved={handleTriggerSaved}
      />

      <TriggerGroupFormSheet
        isOpen={isGroupSheetOpen}
        onClose={handleCloseGroupSheet}
        projectId={projectId}
        existingGroup={editingGroup}
        initialDraft={initialGroupDraft}
        existingTriggers={triggers}
        onSaved={handleTriggerSaved}
      />
    </div>
  );
}

export default function DataMartSchedulesPage() {
  return (
    <ConnectorContextProvider>
      <DataMartSchedulesPageContent />
    </ConnectorContextProvider>
  );
}
