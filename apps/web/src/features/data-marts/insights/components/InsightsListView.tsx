import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ErrorState } from '../../../../shared/components/ErrorState/ErrorState';
import { useNavigate } from 'react-router';
import { Plus, Bookmark, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@owox/ui/components/button';
import type { ColumnDef } from '@tanstack/react-table';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@owox/ui/components/empty';
import {
  CollapsibleCard,
  CollapsibleCardContent,
  CollapsibleCardFooter,
  CollapsibleCardHeader,
  CollapsibleCardHeaderActions,
  CollapsibleCardHeaderTitle,
} from '../../../../shared/components/CollapsibleCard';
import { ConfirmationDialog } from '../../../../shared/components/ConfirmationDialog';
import { UserReference } from '../../../../shared/components/UserReference';
import {
  BaseTable,
  SortableHeader,
  ToggleColumnsHeader,
} from '../../../../shared/components/Table';
import { useBaseTable, useOnboardingVideo } from '../../../../shared/hooks';
import { useDataMartContext } from '../../edit/model';
import { usePermissions } from '../../../../app/permissions';
import { Tooltip, TooltipContent, TooltipTrigger } from '@owox/ui/components/tooltip';
import { formatDateShort, trackEvent } from '../../../../utils';
import type { InsightTemplateEntity } from '../model';
import {
  insightTemplatesService,
  mapInsightTemplateFromDto,
  useInsightTemplates,
  INSIGHT_TEMPLATES_QUERY_KEY,
} from '../model';
import { InsightRowActionsCell } from './InsightRowActionsCell';
import { useTranslation } from 'react-i18next';
import { Input } from '@owox/ui/components/input';

interface InsightTableItem {
  id: string;
  title: string;
  sourcesCount: number;
  modifiedAt: Date;
  createdById: string;
  createdByUser?: import('../../../../shared/types').UserProjection | null;
}

export default function InsightsListView() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { dataMart } = useDataMartContext();
  const { canCreate, canDelete } = usePermissions();

  const queryClient = useQueryClient();
  const {
    data: items = [],
    isLoading: loading,
    isError,
    refetch,
  } = useInsightTemplates(dataMart?.id ?? '');
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setSearch('');
    setDeleteId(null);
  }, [dataMart?.id]);

  const tableItems = useMemo<InsightTableItem[]>(
    () =>
      items
        .filter(item => item.title.toLowerCase().includes(search.trim().toLowerCase()))
        .map(item => ({
          id: item.id,
          title: item.title,
          sourcesCount: item.sourcesCount ?? item.sources.length,
          modifiedAt: item.modifiedAt,
          createdById: item.createdById,
          createdByUser: item.createdByUser,
        })),
    [items, search]
  );

  const columns = useMemo<ColumnDef<InsightTableItem>[]>(
    () => [
      {
        accessorKey: 'title',
        size: 320,
        meta: { title: t('common.title', 'Title') },
        header: ({ column }) => (
          <SortableHeader column={column}>{t('common.title', 'Title')}</SortableHeader>
        ),
        cell: ({ row }) => (
          <div className='overflow-hidden text-ellipsis'>{row.original.title}</div>
        ),
      },
      {
        accessorKey: 'modifiedAt',
        size: 170,
        sortDescFirst: true,
        meta: { title: t('insightsUi.updated', 'Updated') },
        header: ({ column }) => (
          <SortableHeader column={column}>{t('insightsUi.updated', 'Updated')}</SortableHeader>
        ),
        cell: ({ row }) => (
          <div className='text-muted-foreground'>{formatDateShort(row.original.modifiedAt)}</div>
        ),
      },
      {
        id: 'createdBy',
        size: 150,
        enableSorting: false,
        meta: { title: t('common.createdBy', 'Created By') },
        header: t('common.createdBy', 'Created By'),
        cell: ({ row }) =>
          row.original.createdByUser ? (
            <UserReference userProjection={row.original.createdByUser} />
          ) : (
            <span className='text-muted-foreground'>-</span>
          ),
      },
      {
        id: 'actions',
        size: 80,
        enableResizing: false,
        header: ({ table }) => <ToggleColumnsHeader table={table} />,
        cell: ({ row }) => (
          <InsightRowActionsCell
            id={row.original.id}
            canDelete={canDelete}
            onDelete={id => {
              setDeleteId(id);
            }}
          />
        ),
      },
    ],
    [canDelete, t]
  );

  const { table } = useBaseTable<InsightTableItem>({
    data: tableItems,
    columns,
    storageKeyPrefix: 'data-mart-insights',
    defaultSortingColumn: 'modifiedAt',
    enableRowSelection: false,
  });

  const handleCreate = useCallback(async () => {
    if (!dataMart?.id || creating) return;
    setCreating(true);
    try {
      const dto = await insightTemplatesService.createInsightTemplate(dataMart.id, {});
      const insight = mapInsightTemplateFromDto(dto);
      void queryClient.invalidateQueries({ queryKey: [INSIGHT_TEMPLATES_QUERY_KEY, dataMart.id] });
      trackEvent({
        event: 'insight_created',
        category: 'Insights',
        action: 'Create',
        label: insight.id,
        details: insight.title,
        context: dataMart.id,
      });
      toast.success(t('insightsUi.created', 'Insight created'));
      void navigate(insight.id);
    } catch {
      trackEvent({
        event: 'insight_error',
        category: 'Insights',
        action: 'CreateError',
        label: 'Creating insight',
        context: dataMart.id,
      });
      toast.error(t('insightsUi.createFailed', 'Failed to create insight'));
    } finally {
      setCreating(false);
    }
  }, [creating, dataMart?.id, navigate, t, queryClient]);

  const handleConfirmDelete = useCallback(() => {
    void (async () => {
      if (!dataMart?.id || !deleteId) return;

      try {
        await insightTemplatesService.deleteInsightTemplate(dataMart.id, deleteId);
        trackEvent({
          event: 'insight_deleted',
          category: 'Insights',
          action: 'Delete',
          label: deleteId,
          context: dataMart.id,
        });
        await queryClient.cancelQueries({ queryKey: [INSIGHT_TEMPLATES_QUERY_KEY, dataMart.id] });
        queryClient.setQueryData<InsightTemplateEntity[]>(
          [INSIGHT_TEMPLATES_QUERY_KEY, dataMart.id],
          prev => prev?.filter(item => item.id !== deleteId)
        );
        void queryClient.invalidateQueries({
          queryKey: [INSIGHT_TEMPLATES_QUERY_KEY, dataMart.id],
        });
        toast.success(t('insightsUi.deleted', 'Insight deleted'));
      } catch {
        trackEvent({
          event: 'insight_error',
          category: 'Insights',
          action: 'DeleteError',
          label: deleteId,
          context: dataMart.id,
        });
        toast.error(t('insightsUi.deleteFailed', 'Failed to delete insight'));
      } finally {
        setDeleteId(null);
      }
    })();
  }, [dataMart?.id, deleteId, t, queryClient]);

  // Show onboarding video about insights if the user has not seen it yet
  const shouldShowOnboarding = !loading && !isError && items.length === 0;
  useOnboardingVideo({
    storageKey: 'data-mart-insights-onboarding-video-shown',
    popoverId: 'video-5-try-insights',
    shouldShow: shouldShowOnboarding,
  });

  return (
    <CollapsibleCard>
      <CollapsibleCardHeader>
        <CollapsibleCardHeaderTitle
          icon={Bookmark}
          tooltip={t('insightsUi.manageTooltip', 'Manage and review your insights')}
        >
          {t('sidebar.insights', 'Insights')}
        </CollapsibleCardHeaderTitle>
        <CollapsibleCardHeaderActions>
          <div className='relative w-52'>
            <Search className='text-muted-foreground absolute top-2.5 left-2 size-4' />
            <Input
              value={search}
              onChange={event => { setSearch(event.target.value); }}
              placeholder={t('insightsUi.search', 'Search insights')}
              aria-label={t('insightsUi.search', 'Search insights')}
              className='h-9 pl-8'
            />
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className='inline-flex'>
                <Button
                  variant='outline'
                  onClick={() => void handleCreate()}
                  disabled={!canCreate || creating}
                >
                  <Plus className='h-4 w-4' />
                  {t('insightsUi.newInsight', 'New insight')}
                </Button>
              </div>
            </TooltipTrigger>
            {!canCreate && <TooltipContent>{t('common.noPermission')}</TooltipContent>}
          </Tooltip>
        </CollapsibleCardHeaderActions>
      </CollapsibleCardHeader>

      <CollapsibleCardContent>
        {isError && (
          <ErrorState message={t('insightsUi.loadError')} onRetry={() => void refetch()} />
        )}
        {loading && items.length === 0 ? (
          <div className='text-muted-foreground p-4 text-sm'>
            {t('insightsUi.loadingInsights', 'Loading insights…')}
          </div>
        ) : isError && items.length === 0 ? null : items.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant='icon'>
                <Bookmark />
              </EmptyMedia>
              <EmptyTitle>
                {t('insightsUi.firstInsightTitle', 'Create your first Insight')}
              </EmptyTitle>
              <EmptyDescription>
                {t(
                  'insightsUi.firstInsightDescription',
                  'Create insights to build scheduled reports and deliver them to your preferred channels (Email, Slack, etc.)'
                )}
              </EmptyDescription>
            </EmptyHeader>

            <EmptyContent>
              <div className='inline-flex'>
                <Button disabled={!canCreate || creating} onClick={() => void handleCreate()}>
                  <Plus className='h-4 w-4' />
                  {t('insightsUi.newInsight', 'New Insight')}
                </Button>
              </div>
            </EmptyContent>
          </Empty>
        ) : (
          <BaseTable
            tableId='insights-table'
            table={table}
            onRowClick={row => {
              void navigate(row.original.id);
            }}
            ariaLabel={t('sidebar.insights', 'Insights')}
            paginationProps={{
              displaySelected: false,
            }}
            renderEmptyState={() => (
              <span role='status' aria-live='polite'>
                {t('insightsUi.noInsightsFound', 'No insights found.')}
              </span>
            )}
          />
        )}

        <ConfirmationDialog
          open={Boolean(deleteId)}
          onOpenChange={open => {
            if (!open) {
              setDeleteId(null);
            }
          }}
          title={t('insightsUi.deleteInsightTitle', 'Delete insight')}
          description={t(
            'insightsUi.deleteInsightConfirm',
            'Are you sure you want to delete this insight? This action cannot be undone.'
          )}
          confirmLabel={t('common.delete', 'Delete')}
          cancelLabel={t('common.cancel', 'Cancel')}
          variant='destructive'
          onConfirm={handleConfirmDelete}
        />
      </CollapsibleCardContent>
      <CollapsibleCardFooter />
    </CollapsibleCard>
  );
}
