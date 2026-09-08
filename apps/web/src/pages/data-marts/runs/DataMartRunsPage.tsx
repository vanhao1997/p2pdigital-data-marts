import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { Button } from '@owox/ui/components/button';
import { SkeletonList } from '@owox/ui/components/common/skeleton-list';
import { extractApiError } from '../../../app/api';
import {
  DataMartRunType,
  dataMartQueryKeys,
  dataMartService,
} from '../../../features/data-marts/shared';
import { isDataMartRunFinalStatus } from '../../../features/data-marts/shared/utils/status.utils';
import { RunItem } from '../../../features/data-marts/edit/components/DataMartRunHistoryView';
import { LogViewType } from '../../../features/data-marts/edit/components/DataMartRunHistoryView/types';
import { mapProjectDataMartRunListResponseDtoToEntity } from '../../../features/data-marts/edit/model/mappers';
import type { ProjectDataMartRunItem } from '../../../features/data-marts/edit/model/types';
import type { ConnectorListItem } from '../../../features/connectors/shared/model/types/connector';
import { getConnectorInfoByName } from '../../../features/connectors/shared/utils';
import { useProjectRoute } from '../../../shared/hooks';
import { ProjectDataMartEmptyState } from '../shared/ProjectDataMartEmptyState';
import { useTranslation } from 'react-i18next';
import { useAutoRefresh } from '../../../hooks/useAutoRefresh';
import { recordWebSyncRefresh } from '../../../utils/sync-telemetry';
import { useParams } from 'react-router';

const PROJECT_RUNS_PAGE_SIZE = 50;

export default function DataMartRunsPage() {
  const { t } = useTranslation();
  const { projectId = '' } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const { scope } = useProjectRoute();
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [pollingErrorCount, setPollingErrorCount] = useState(0);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [logViewType, setLogViewType] = useState<LogViewType>(LogViewType.STRUCTURED);
  const [searchTerm, setSearchTerm] = useState('');
  const [connectorInfoByName, setConnectorInfoByName] = useState<
    Record<string, ConnectorListItem | null>
  >({});
  const requestGenerationRef = useRef(0);

  const runsQuery = useQuery({
    queryKey: dataMartQueryKeys.runs(projectId),
    queryFn: async ({ signal }) => {
      const response = await dataMartService.getProjectDataMartRuns(PROJECT_RUNS_PAGE_SIZE, 0, {
        signal,
      });
      const nextRuns = mapProjectDataMartRunListResponseDtoToEntity(response);
      return { runs: nextRuns, hasMore: nextRuns.length >= PROJECT_RUNS_PAGE_SIZE };
    },
  });

  const runs = useMemo(() => runsQuery.data?.runs ?? [], [runsQuery.data?.runs]);
  const isLoading = runsQuery.isLoading;
  const queryError = runsQuery.isError
    ? (extractApiError(runsQuery.error).message ?? t('projectDataMartPages.loadRunsFailed'))
    : null;
  const error = queryError && runs.length === 0 ? queryError : null;
  const hasMoreRunsToLoad = runsQuery.data?.hasMore ?? false;

  const { refetch: refetchRuns } = runsQuery;
  const loadRuns = useCallback(
    async (offset = 0, options?: { silent?: boolean; signal?: AbortSignal }): Promise<boolean> => {
      const isInitialLoad = offset === 0;
      const isSilent = options?.silent === true;
      const signal = options?.signal;
      const requestGeneration = ++requestGenerationRef.current;

      if (isInitialLoad && !isSilent && !signal) {
        const result = await refetchRuns();
        if (result.isSuccess) setPollingErrorCount(0);
        return true;
      }

      const requestConfig =
        isSilent || signal
          ? {
              ...(isSilent ? { skipLoadingIndicator: true, skipErrorToast: true } : {}),
              ...(signal ? { signal } : {}),
            }
          : undefined;

      if (isInitialLoad) {
        // Query owns initial loading state; silent refreshes update cached rows only.
      } else {
        setIsLoadingMore(true);
      }

      try {
        const response = await dataMartService.getProjectDataMartRuns(
          PROJECT_RUNS_PAGE_SIZE,
          offset,
          requestConfig
        );
        const nextRuns = mapProjectDataMartRunListResponseDtoToEntity(response);
        if (requestGeneration !== requestGenerationRef.current || signal?.aborted) return false;
        if (isSilent) {
          setPollingErrorCount(0);
          recordWebSyncRefresh(projectId, 'runs', false);
        }
        queryClient.setQueryData<{ runs: ProjectDataMartRunItem[]; hasMore: boolean }>(
          dataMartQueryKeys.runs(projectId),
          current => {
            if (!isInitialLoad) {
              return {
                runs: [...(current?.runs ?? []), ...nextRuns],
                hasMore: nextRuns.length >= PROJECT_RUNS_PAGE_SIZE,
              };
            }

            if (!isSilent) {
              return { runs: nextRuns, hasMore: nextRuns.length >= PROJECT_RUNS_PAGE_SIZE };
            }

            const nextRunIds = new Set(nextRuns.map(run => run.id));
            const loadedOlderRuns = (current?.runs ?? []).filter(run => !nextRunIds.has(run.id));
            return {
              runs: [...nextRuns, ...loadedOlderRuns],
              hasMore: current?.hasMore ?? nextRuns.length >= PROJECT_RUNS_PAGE_SIZE,
            };
          }
        );
        return nextRuns.some(run => !isDataMartRunFinalStatus(run.status));
      } catch {
        const aborted = signal?.aborted ?? false;
        if (isSilent && !aborted) {
          setPollingErrorCount(count => count + 1);
          recordWebSyncRefresh(projectId, 'runs', true);
        }
        return true;
      } finally {
        if (!isInitialLoad) {
          setIsLoadingMore(false);
        }
      }
    },
    [projectId, queryClient, refetchRuns]
  );

  const hasActiveRuns = useMemo(
    () => runs.some(run => !isDataMartRunFinalStatus(run.status)),
    [runs]
  );
  const pollInterval = useCallback((pollCount: number) => (pollCount < 3 ? 2000 : 5000), []);

  useAutoRefresh({
    enabled: hasActiveRuns && !isLoadingMore,
    intervalMs: pollInterval,
    runImmediately: false,
    resourceKey: projectId,
    onTick: signal => loadRuns(0, { silent: true, signal }),
  });

  const connectorSourceNames = useMemo(() => {
    const names = runs.map(getConnectorSourceName).filter((name): name is string => Boolean(name));
    return Array.from(new Set(names)).sort();
  }, [runs]);

  useEffect(() => {
    const missingConnectorNames = connectorSourceNames.filter(
      name => !(name in connectorInfoByName)
    );
    if (missingConnectorNames.length === 0) return;

    void (async () => {
      const entries: [string, ConnectorListItem | null][] = [];

      for (const name of missingConnectorNames) {
        try {
          entries.push([name, await getConnectorInfoByName(name)]);
        } catch {
          entries.push([name, null]);
        }
      }

      setConnectorInfoByName(current => ({
        ...current,
        ...Object.fromEntries(entries),
      }));
    })();
  }, [connectorInfoByName, connectorSourceNames]);

  const loadMoreRuns = useCallback(async () => {
    if (isLoadingMore || !hasMoreRunsToLoad) return;
    await loadRuns(runs.length);
  }, [hasMoreRunsToLoad, isLoadingMore, loadRuns, runs.length]);

  const cancelDataMartRun = useCallback(
    async (dataMartId: string, runId: string) => {
      try {
        await dataMartService.cancelDataMartRun(dataMartId, runId);
        await queryClient.invalidateQueries({ queryKey: dataMartQueryKeys.runsRoot(projectId) });
      } catch (caught) {
        throw new Error(
          extractApiError(caught).message ?? t('projectDataMartPages.cancelRunFailed')
        );
      }
    },
    [projectId, queryClient, t]
  );

  const toggleRunDetails = (runId: string) => {
    setExpandedRun(current => (current === runId ? null : runId));
  };

  return (
    <div className='dm-page' data-testid='dataMartRunsPage'>
      <header className='dm-page-header'>
        <h1 className='dm-page-header-title'>{t('projectDataMartPages.runsTitle')}</h1>
      </header>

      <div className='dm-page-content'>
        {pollingErrorCount >= 3 && (
          <div
            className='dm-card-block mb-3 flex items-center justify-between gap-3 text-sm'
            role='status'
          >
            <span>{t('projectDataMartPages.staleRefresh')}</span>
            <Button size='sm' variant='outline' onClick={() => void loadRuns(0)}>
              {t('common.retry')}
            </Button>
          </div>
        )}
        {queryError && runs.length > 0 && (
          <div
            className='dm-card-block mb-3 flex items-center justify-between gap-3 text-sm'
            role='status'
          >
            <span className='text-muted-foreground'>{queryError}</span>
            <Button size='sm' variant='outline' onClick={() => void loadRuns(0)}>
              {t('common.retry')}
            </Button>
          </div>
        )}
        {isLoading ? (
          <SkeletonList />
        ) : error ? (
          <div className='dm-card-block text-destructive text-sm'>{error}</div>
        ) : runs.length === 0 ? (
          <div className='dm-card'>
            <ProjectDataMartEmptyState variant='runs' />
          </div>
        ) : (
          <div className='space-y-2' data-testid='projectRunHistoryList'>
            {runs.map(run => (
              <RunItem
                key={run.id}
                run={run}
                isExpanded={expandedRun === run.id}
                onToggle={toggleRunDetails}
                logViewType={logViewType}
                setLogViewType={setLogViewType}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                cancelDataMartRun={cancelDataMartRun}
                dataMartId={run.dataMart.id}
                dataMartConnectorInfo={getConnectorInfoForRun(run, connectorInfoByName)}
                dataMartRef={{
                  id: run.dataMart.id,
                  title: run.dataMart.title,
                  href: scope(`/data-marts/${run.dataMart.id}/run-history`),
                }}
              />
            ))}

            {hasMoreRunsToLoad && (
              <div className='flex justify-center pt-4 pb-6'>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => void loadMoreRuns()}
                  disabled={isLoadingMore}
                  className='flex items-center gap-2'
                >
                  {isLoadingMore ? (
                    <>
                      <RefreshCw className='h-4 w-4 animate-spin' />
                      {t('projectDataMartPages.loadingMore')}
                    </>
                  ) : (
                    t('projectDataMartPages.loadMore')
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function getConnectorSourceName(run: ProjectDataMartRunItem): string | null {
  const definitionRun = run.definitionRun as ProjectDataMartRunItem['definitionRun'] | null;

  if (run.type !== DataMartRunType.CONNECTOR || !definitionRun || !('connector' in definitionRun)) {
    return null;
  }

  return definitionRun.connector.source.name;
}

function getConnectorInfoForRun(
  run: ProjectDataMartRunItem,
  connectorInfoByName: Record<string, ConnectorListItem | null>
): ConnectorListItem | null {
  const connectorSourceName = getConnectorSourceName(run);
  if (!connectorSourceName) return null;

  return connectorInfoByName[connectorSourceName] ?? null;
}
