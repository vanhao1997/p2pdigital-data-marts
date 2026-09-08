import { useCallback, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import RelativeTime from '@owox/ui/components/common/relative-time';
import { SkeletonList } from '@owox/ui/components/common/skeleton-list';
import { extractApiError } from '../../../app/api';
import { DataDestinationType, DataDestinationTypeModel } from '../../../features/data-destination';
import { DataMartContext } from '../../../features/data-marts/edit/model/context/context';
import {
  EmailActionsCell,
  ReportActionsCell,
  StatusIcon,
} from '../../../features/data-marts/reports/list/components';
import { ReportEditSheetRenderer } from '../../../features/data-marts/reports/list/components/DestinationCard/ReportEditSheetRenderer';
import { useReportSidesheet } from '../../../features/data-marts/reports/list/model/hooks';
import { mapReportDtoToEntity } from '../../../features/data-marts/reports/shared/model/mappers';
import { ReportsProvider } from '../../../features/data-marts/reports/shared/model/context';
import { ReportQuickRunCell } from '../../../features/data-marts/reports/shared';
import type { DataMartReport } from '../../../features/data-marts/reports/shared/model/types/data-mart-report';
import { ReportStatusEnum } from '../../../features/data-marts/reports/shared/enums';
import { reportService } from '../../../features/data-marts/reports/shared/services';
import { BaseTable, SortableHeader, ToggleColumnsHeader } from '../../../shared/components/Table';
import {
  applyFiltersToData,
  type FilterAccessors,
  type FilterConfigItem,
} from '../../../shared/components/TableFilters';
import { collectOptionsFromData } from '../../../shared/components/TableFilters/collectOptions.utils';
import { UserAvatarGroup } from '../../../shared/components/UserAvatarGroup';
import { UserReference } from '../../../shared/components/UserReference';
import { useBaseTable, usePersistentFilters, useProjectRoute } from '../../../shared/hooks';
import { ProjectDataMartTableFilters } from '../shared/ProjectDataMartTableFilters';
import { ProjectDataMartTableSearch } from '../shared/ProjectDataMartTableSearch';
import {
  buildProjectTableUserLabelMapper,
  matchesProjectTableSearch,
} from '../shared/ProjectDataMartTableFilters.utils';
import { buildProjectDataMartContextValue } from '../shared/projectDataMartContext';
import { ProjectDataMartEmptyState } from '../shared/ProjectDataMartEmptyState';
import { ProjectDataMartTitleLink } from '../shared/ProjectDataMartTitleLink';
import { mergeReportPagePreservingRows } from './DataMartReportsPage.utils';
import {
  ReportGeneratedSqlAction,
  ReportOpenDocumentAction,
  ReportTitleCell,
  reportTitleCellQuickActionClassName,
} from '../../../features/data-marts/reports/shared/components';
import { useTranslation } from 'react-i18next';
import { dataMartQueryKeys } from '../../../features/data-marts/shared';
import { useAutoRefresh } from '../../../hooks/useAutoRefresh';
import { recordWebSyncRefresh } from '../../../utils/sync-telemetry';

const PROJECT_REPORTS_TABLE_PAGE_SIZE = 15;
const PROJECT_REPORTS_TABLE_ID = 'project-reports-table';

// A rejected poll keeps the row RUNNING, so the interval never stops retrying it.
const POLL_REQUEST_OPTIONS = {
  skipErrorToast: true,
} as const;

type ProjectReportFilterKey =
  | 'dataMart'
  | 'report'
  | 'destination'
  | 'runStatus'
  | 'createdBy'
  | 'owners';

const projectReportFilterAccessors: FilterAccessors<ProjectReportFilterKey, DataMartReport> = {
  dataMart: row => row.dataMart.title,
  report: row => row.title,
  destination: row => row.dataDestination.title,
  runStatus: row => row.lastRunStatus ?? 'never',
  createdBy: row => row.createdByUser?.userId,
  owners: row => (row.ownerUsers ?? []).map(user => user.userId),
};

function buildProjectReportFilters(
  data: DataMartReport[],
  t: (key: string) => string
): FilterConfigItem<ProjectReportFilterKey>[] {
  const userLabelMapper = buildProjectTableUserLabelMapper(
    data.flatMap(report => [report.createdByUser, ...(report.ownerUsers ?? [])])
  );

  return [
    {
      id: 'dataMart',
      label: t('search.labelDataMart'),
      dataType: 'string',
      operators: ['contains', 'not_contains', 'eq', 'neq'],
      options: collectOptionsFromData(data, projectReportFilterAccessors.dataMart),
    },
    {
      id: 'report',
      label: t('projectDataMartPages.reportLabel'),
      dataType: 'string',
      operators: ['contains', 'not_contains', 'eq', 'neq'],
      options: collectOptionsFromData(data, projectReportFilterAccessors.report),
    },
    {
      id: 'destination',
      label: t('search.labelDestination'),
      dataType: 'string',
      operators: ['contains', 'not_contains', 'eq', 'neq'],
      options: collectOptionsFromData(data, projectReportFilterAccessors.destination),
    },
    {
      id: 'runStatus',
      label: t('projectDataMartPages.runStatusLabel'),
      dataType: 'enum',
      operators: ['eq', 'neq'],
      options: collectOptionsFromData(data, projectReportFilterAccessors.runStatus, {
        labelMapper: value => (value === 'never' ? t('projectDataMartPages.neverRun') : value),
      }),
    },
    {
      id: 'createdBy',
      label: t('common.createdBy'),
      dataType: 'enum',
      operators: ['eq', 'neq'],
      options: collectOptionsFromData(data, projectReportFilterAccessors.createdBy, {
        labelMapper: userLabelMapper,
      }),
    },
    {
      id: 'owners',
      label: t('projectDataMartPages.ownersLabel'),
      dataType: 'enum',
      operators: ['eq', 'neq'],
      options: collectOptionsFromData(data, projectReportFilterAccessors.owners, {
        labelMapper: userLabelMapper,
      }),
    },
  ];
}

function ProjectReportTitleCell({ report }: { report: DataMartReport }) {
  let quickActions: ReactNode = null;

  // The open-document action hides itself for a config that names no document, so an Excel
  // report gets the SQL action and nothing else without needing a branch of its own.
  switch (report.dataDestination.type) {
    case DataDestinationType.GOOGLE_SHEETS:
    case DataDestinationType.EXCEL:
      quickActions = (
        <>
          <ReportOpenDocumentAction
            report={report}
            className={reportTitleCellQuickActionClassName}
          />
          <ReportGeneratedSqlAction
            report={report}
            className={reportTitleCellQuickActionClassName}
          />
        </>
      );
      break;

    case DataDestinationType.EMAIL:
    case DataDestinationType.SLACK:
    case DataDestinationType.GOOGLE_CHAT:
    case DataDestinationType.MS_TEAMS:
      quickActions = (
        <ReportGeneratedSqlAction report={report} className={reportTitleCellQuickActionClassName} />
      );
      break;
  }

  return <ReportTitleCell title={report.title} actions={quickActions} />;
}

interface ProjectReportActionsCellProps {
  report: DataMartReport;
  onEditReport: (report: DataMartReport) => void;
  onReportActionComplete: () => void | Promise<void>;
}

function ProjectReportActionsCell({
  report,
  onEditReport,
  onReportActionComplete,
}: ProjectReportActionsCellProps) {
  const dataMartContextValue = useMemo(
    () => buildProjectDataMartContextValue(report.dataMart),
    [report.dataMart]
  );
  const actionProps = {
    row: { original: report },
    onDeleteSuccess: onReportActionComplete,
    onRunSuccess: onReportActionComplete,
    onEditReport,
  };

  let actionsCell: ReactNode = null;

  switch (report.dataDestination.type) {
    case DataDestinationType.GOOGLE_SHEETS:
    case DataDestinationType.EXCEL:
      actionsCell = <ReportActionsCell {...actionProps} />;
      break;
    case DataDestinationType.EMAIL:
    case DataDestinationType.SLACK:
    case DataDestinationType.GOOGLE_CHAT:
    case DataDestinationType.MS_TEAMS:
      actionsCell = <EmailActionsCell {...actionProps} />;
      break;
  }

  return (
    <DataMartContext.Provider value={dataMartContextValue}>{actionsCell}</DataMartContext.Provider>
  );
}

export default function DataMartReportsPage() {
  const { t } = useTranslation();
  const { projectId = '' } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const { scope } = useProjectRoute();
  const [pollingErrorCount, setPollingErrorCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const latestPollRef = useRef(0);
  const {
    isOpen: isReportEditSheetOpen,
    mode: reportEditMode,
    editingReport,
    handleEditReport,
    handleCloseModal,
  } = useReportSidesheet();

  const reportsQuery = useQuery({
    queryKey: dataMartQueryKeys.reports(projectId),
    queryFn: async ({ signal }) => {
      const response = await reportService.getReportsByProject(undefined, undefined, { signal });
      return response.map(mapReportDtoToEntity);
    },
  });

  const reports = useMemo(() => reportsQuery.data ?? [], [reportsQuery.data]);
  const isLoading = reportsQuery.isLoading;
  const queryError = reportsQuery.isError
    ? (extractApiError(reportsQuery.error).message ?? t('projectDataMartPages.loadReportsFailed'))
    : null;
  const error = queryError && reports.length === 0 ? queryError : null;

  const { refetch: refetchReports } = reportsQuery;
  const loadReports = useCallback(async () => {
    latestPollRef.current += 1;
    const result = await refetchReports();
    if (result.isSuccess) setPollingErrorCount(0);
  }, [refetchReports]);

  const refreshReportsByIds = useCallback(
    async (reportIds: string[], signal?: AbortSignal): Promise<boolean> => {
      const requestId = ++latestPollRef.current;
      const responses = await Promise.allSettled(
        reportIds.map(reportId =>
          reportService.getReportById(reportId, {
            ...POLL_REQUEST_OPTIONS,
            ...(signal ? { signal } : {}),
          })
        )
      );
      const nextReports = responses.flatMap(response =>
        response.status === 'fulfilled' ? [mapReportDtoToEntity(response.value)] : []
      );
      if (requestId !== latestPollRef.current || signal?.aborted) return false;

      const failed = responses.some(response => response.status === 'rejected');
      if (failed) {
        setPollingErrorCount(count => count + 1);
        recordWebSyncRefresh(projectId, 'reports', true);
      } else {
        setPollingErrorCount(0);
        recordWebSyncRefresh(projectId, 'reports', false);
      }

      if (nextReports.length === 0) {
        return true;
      }

      queryClient.setQueryData<DataMartReport[]>(dataMartQueryKeys.reports(projectId), current =>
        mergeReportPagePreservingRows(current ?? [], nextReports)
      );
      return (
        failed || nextReports.some(report => report.lastRunStatus === ReportStatusEnum.RUNNING)
      );
    },
    [projectId, queryClient]
  );

  const handleCloseReportEditSheet = useCallback(() => {
    handleCloseModal();
  }, [handleCloseModal]);

  const handleReportActionComplete = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: dataMartQueryKeys.reportsRoot(projectId) });
  }, [projectId, queryClient]);

  const reportDataMartContextValue = useMemo(
    () => (editingReport ? buildProjectDataMartContextValue(editingReport.dataMart) : null),
    [editingReport]
  );

  const filtersConfig = useMemo(() => buildProjectReportFilters(reports, t), [reports, t]);

  const { appliedState, apply, clear } = usePersistentFilters<ProjectReportFilterKey>({
    projectId,
    tableId: PROJECT_REPORTS_TABLE_ID,
    urlParam: 'filters',
    config: filtersConfig,
  });

  const filteredReports = useMemo(
    () =>
      applyFiltersToData<ProjectReportFilterKey, DataMartReport>(
        reports,
        appliedState,
        projectReportFilterAccessors
      ),
    [appliedState, reports]
  );

  const searchedReports = useMemo(
    () =>
      filteredReports.filter(report =>
        matchesProjectTableSearch(searchQuery, [
          report.dataMart.title,
          report.title,
          report.dataDestination.title,
          report.lastRunStatus,
          report.createdByUser?.fullName,
          report.createdByUser?.email,
          (report.ownerUsers ?? []).flatMap(user => [user.fullName, user.email]),
        ])
      ),
    [filteredReports, searchQuery]
  );

  const columns = useMemo<ColumnDef<DataMartReport>[]>(
    () => [
      {
        id: 'quickRun',
        size: 50,
        enableResizing: false,
        enableSorting: false,
        enableHiding: false,
        header: () => null,
        cell: ({ row }) => (
          <ReportQuickRunCell report={row.original} onRunSuccess={handleReportActionComplete} />
        ),
      },
      {
        id: 'dataMart',
        accessorFn: row => row.dataMart.title,
        size: 260,
        meta: { title: t('search.labelDataMart') },
        header: ({ column }) => (
          <SortableHeader column={column}>{t('search.labelDataMart')}</SortableHeader>
        ),
        cell: ({ row }) => (
          <ProjectDataMartTitleLink
            to={scope(`/data-marts/${row.original.dataMart.id}/reports`)}
            title={row.original.dataMart.title}
          />
        ),
      },
      {
        accessorKey: 'title',
        size: 320,
        meta: { title: t('projectDataMartPages.reportLabel') },
        header: ({ column }) => (
          <SortableHeader column={column}>{t('projectDataMartPages.reportLabel')}</SortableHeader>
        ),
        cell: ({ row }) => {
          const title = row.original.title.trim();
          if (!title) {
            return <span className='text-muted-foreground'>—</span>;
          }
          return <ProjectReportTitleCell report={row.original} />;
        },
      },
      {
        id: 'destination',
        accessorFn: row => row.dataDestination.title,
        size: 220,
        meta: { title: t('search.labelDestination') },
        header: ({ column }) => (
          <SortableHeader column={column}>{t('search.labelDestination')}</SortableHeader>
        ),
        cell: ({ row }) => {
          const { displayName, icon: Icon } = DataDestinationTypeModel.getInfo(
            row.original.dataDestination.type
          );

          return (
            <div className='text-muted-foreground flex min-w-0 items-center gap-2'>
              <Icon size={18} className='shrink-0' />
              <span className='truncate'>{row.original.dataDestination.title || displayName}</span>
            </div>
          );
        },
      },
      {
        accessorKey: 'lastRunDate',
        size: 170,
        sortDescFirst: true,
        meta: { title: t('projectDataMartPages.lastRunLabel') },
        header: ({ column }) => (
          <SortableHeader column={column}>{t('projectDataMartPages.lastRunLabel')}</SortableHeader>
        ),
        cell: ({ row }) => (
          <div className='text-muted-foreground text-sm'>
            {row.original.lastRunDate ? (
              <RelativeTime date={row.original.lastRunDate} />
            ) : (
              t('projectDataMartPages.neverRun')
            )}
          </div>
        ),
      },
      {
        accessorKey: 'lastRunStatus',
        size: 150,
        meta: { title: t('projectDataMartPages.runStatusLabel') },
        header: ({ column }) => (
          <SortableHeader column={column}>
            {t('projectDataMartPages.runStatusLabel')}
          </SortableHeader>
        ),
        cell: ({ row }) =>
          row.original.lastRunStatus ? (
            <StatusIcon status={row.original.lastRunStatus} error={row.original.lastRunError} />
          ) : (
            <span className='text-muted-foreground text-sm'>—</span>
          ),
      },
      {
        id: 'createdBy',
        accessorFn: row => row.createdByUser?.fullName ?? row.createdByUser?.email,
        size: 190,
        meta: { title: t('common.createdBy') },
        header: ({ column }) => (
          <SortableHeader column={column}>{t('common.createdBy')}</SortableHeader>
        ),
        cell: ({ row }) => {
          const user = row.original.createdByUser;
          if (!user) return <span className='text-muted-foreground'>-</span>;
          return <UserReference userProjection={user} />;
        },
      },
      {
        id: 'owners',
        accessorFn: row =>
          (row.ownerUsers ?? []).map(user => user.fullName ?? user.email).join(', '),
        size: 190,
        meta: { title: t('projectDataMartPages.ownersLabel') },
        header: ({ column }) => (
          <SortableHeader column={column}>{t('projectDataMartPages.ownersLabel')}</SortableHeader>
        ),
        cell: ({ row }) => {
          const users = row.original.ownerUsers ?? [];
          if (users.length === 0) {
            return (
              <span className='text-muted-foreground text-sm'>
                {t('projectDataMartPages.notAssigned')}
              </span>
            );
          }
          if (users.length === 1) return <UserReference userProjection={users[0]} />;
          return <UserAvatarGroup users={users} />;
        },
      },
      {
        id: 'actions',
        size: 50,
        enableResizing: false,
        enableSorting: false,
        header: ({ table }) => <ToggleColumnsHeader table={table} />,
        cell: ({ row }) => (
          <ProjectReportActionsCell
            report={row.original}
            onEditReport={handleEditReport}
            onReportActionComplete={handleReportActionComplete}
          />
        ),
      },
    ],
    [handleEditReport, handleReportActionComplete, scope, t]
  );

  const { table } = useBaseTable<DataMartReport>({
    data: searchedReports,
    columns,
    storageKeyPrefix: 'project-data-mart-reports',
    defaultSortingColumn: 'lastRunDate',
    defaultPageSize: PROJECT_REPORTS_TABLE_PAGE_SIZE,
    enableRowSelection: false,
  });

  const visibleRunningReportIds = table
    .getRowModel()
    .rows.filter(row => row.original.lastRunStatus === ReportStatusEnum.RUNNING)
    .map(row => row.original.id);
  const visibleRunningReportIdsKey = visibleRunningReportIds.join('\0');
  const pollInterval = useCallback((pollCount: number) => (pollCount < 3 ? 2000 : 5000), []);

  useAutoRefresh({
    enabled: Boolean(visibleRunningReportIdsKey),
    intervalMs: pollInterval,
    runImmediately: false,
    resourceKey: `${projectId}:${visibleRunningReportIdsKey}`,
    onTick: signal => refreshReportsByIds(visibleRunningReportIdsKey.split('\0'), signal),
  });

  return (
    <ReportsProvider>
      <div className='dm-page' data-testid='dataMartReportsPage'>
        <header className='dm-page-header'>
          <h1 className='dm-page-header-title'>{t('projectDataMartPages.reportsTitle')}</h1>
        </header>

        <div className='dm-page-content'>
          {pollingErrorCount >= 3 && (
            <div
              className='dm-card-block mb-3 flex items-center justify-between gap-3 text-sm'
              role='status'
            >
              <span>{t('projectDataMartPages.staleRefresh')}</span>
              <button
                type='button'
                className='text-primary font-medium underline underline-offset-4'
                onClick={() => void loadReports()}
              >
                {t('common.retry')}
              </button>
            </div>
          )}
          {queryError && reports.length > 0 && (
            <div
              className='dm-card-block mb-3 flex items-center justify-between gap-3 text-sm'
              role='status'
            >
              <span className='text-muted-foreground'>{queryError}</span>
              <button
                type='button'
                className='text-primary font-medium underline underline-offset-4'
                onClick={() => void loadReports()}
              >
                {t('common.retry')}
              </button>
            </div>
          )}
          {isLoading ? (
            <SkeletonList />
          ) : error ? (
            <div className='dm-card-block text-destructive text-sm'>{error}</div>
          ) : reports.length === 0 ? (
            <div className='dm-card'>
              <ProjectDataMartEmptyState variant='reports' />
            </div>
          ) : (
            <div className='dm-card' data-testid='projectReportsTable'>
              <BaseTable
                tableId={PROJECT_REPORTS_TABLE_ID}
                table={table}
                ariaLabel={t('projectDataMartPages.tableAriaLabel')}
                paginationProps={{ displaySelected: false }}
                renderToolbarLeft={() => (
                  <>
                    <ProjectDataMartTableFilters
                      appliedState={appliedState}
                      config={filtersConfig}
                      onApply={apply}
                      onClear={clear}
                    />
                    <ProjectDataMartTableSearch value={searchQuery} onChange={setSearchQuery} />
                  </>
                )}
                renderEmptyState={() => (
                  <div
                    className='flex h-32 items-center justify-center text-center'
                    role='status'
                    aria-live='polite'
                  >
                    {t('projectDataMartPages.noReportsForAccessible')}
                  </div>
                )}
                onRowClick={row => {
                  if (row.original.canEditConfig) {
                    handleEditReport(row.original);
                  }
                }}
              />
            </div>
          )}
        </div>

        {editingReport && reportDataMartContextValue && (
          <DataMartContext.Provider value={reportDataMartContextValue}>
            <ReportEditSheetRenderer
              destination={editingReport.dataDestination}
              isOpen={isReportEditSheetOpen}
              onClose={handleCloseReportEditSheet}
              onSubmitSuccess={handleReportActionComplete}
              mode={reportEditMode}
              initialReport={editingReport}
            />
          </DataMartContext.Provider>
        )}
      </div>
    </ReportsProvider>
  );
}
