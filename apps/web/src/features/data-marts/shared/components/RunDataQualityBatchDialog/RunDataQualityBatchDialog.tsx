import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ConfirmationDialog } from '../../../../../shared/components/ConfirmationDialog';
import { dataQualityQueryKeys } from '../../../data-quality/model/use-data-quality-workspace';
import { dataQualityBatchApi, type DataQualityBatchRunItem } from './data-quality-batch.api';

interface RunDataQualityBatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dataMarts: { id: string }[];
  projectId: string;
  onCompleted: () => void | Promise<void>;
  targetScope?: 'selection' | 'canvas';
}

export function RunDataQualityBatchDialog({
  open,
  onOpenChange,
  dataMarts,
  projectId,
  onCompleted,
  targetScope = 'selection',
}: RunDataQualityBatchDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isRunning, setIsRunning] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const selectedCount = dataMarts.length;

  useEffect(() => {
    if (!open) setRequestError(null);
  }, [open]);

  const handleRun = async () => {
    if (selectedCount === 0 || isRunning) return;

    setIsRunning(true);
    setRequestError(null);

    let items: DataQualityBatchRunItem[];
    try {
      const response = await dataQualityBatchApi.run(dataMarts.map(dataMart => dataMart.id));
      items = response.items;
    } catch (error) {
      setRequestError(t('dataQualityBatch.startFailed', { error: getErrorMessage(t, error) }));
      setIsRunning(false);
      return;
    }

    const successfulItems = items.filter(
      (item): item is Extract<DataQualityBatchRunItem, { status: 'SUCCESS' }> =>
        item.status === 'SUCCESS'
    );
    const refreshes = successfulItems.map(item =>
      Promise.resolve().then(() =>
        queryClient.invalidateQueries({
          queryKey: dataQualityQueryKeys.root(projectId, item.dataMartId),
        })
      )
    );
    refreshes.push(
      Promise.resolve().then(() =>
        queryClient.invalidateQueries({
          queryKey: dataQualityQueryKeys.summariesRoot(projectId),
        })
      )
    );

    const refreshResults = await Promise.allSettled(refreshes);
    let completionFailed = false;
    try {
      await onCompleted();
    } catch {
      completionFailed = true;
    }

    setIsRunning(false);
    showBatchResult(t, selectedCount, successfulItems.length, getFailedItems(items));
    if (
      successfulItems.length > 0 &&
      (completionFailed || refreshResults.some(result => result.status === 'rejected'))
    ) {
      toast.error(t('dataQualityBatch.refreshFailed', { count: successfulItems.length }));
    }
    onOpenChange(false);
  };

  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={next => {
        if (!isRunning) onOpenChange(next);
      }}
      title={t('dataQualityBatch.title')}
      description={
        targetScope === 'canvas'
          ? t('dataQualityBatch.canvasDescription', { count: selectedCount })
          : t('dataQualityBatch.selectionDescription', { count: selectedCount })
      }
      confirmLabel={isRunning ? t('dataQualityBatch.starting') : t('dataQualityBatch.confirm')}
      cancelLabel={t('common.cancel')}
      confirmDisabled={selectedCount === 0 || isRunning}
      variant='brand'
      onConfirm={() => {
        void handleRun();
      }}
    >
      {requestError && <p className='text-destructive text-sm'>{requestError}</p>}
    </ConfirmationDialog>
  );
}

function showBatchResult(
  t: ReturnType<typeof useTranslation>['t'],
  selectedCount: number,
  successfulCount: number,
  failedItems: Extract<DataQualityBatchRunItem, { status: 'ERROR' }>[]
): void {
  if (successfulCount === selectedCount) {
    toast.success(
      selectedCount === 1
        ? t('dataQualityBatch.queuedOne')
        : t('dataQualityBatch.queuedMany', { count: selectedCount })
    );
    return;
  }

  if (successfulCount > 0) {
    toast.error(
      t('dataQualityBatch.queuedPartial', {
        successful: successfulCount,
        selected: selectedCount,
        failures: formatFailureSummary(t, failedItems),
      })
    );
    return;
  }

  toast.error(
    selectedCount === 1
      ? t('dataQualityBatch.queueFailedOne', {
          error: failedItems[0]?.message ?? t('common.unknown'),
        })
      : t('dataQualityBatch.queueFailedMany', { failures: formatFailureSummary(t, failedItems) })
  );
}

function getFailedItems(
  items: DataQualityBatchRunItem[]
): Extract<DataQualityBatchRunItem, { status: 'ERROR' }>[] {
  return items.filter(
    (item): item is Extract<DataQualityBatchRunItem, { status: 'ERROR' }> => item.status === 'ERROR'
  );
}

function formatFailureSummary(
  t: ReturnType<typeof useTranslation>['t'],
  failedItems: Extract<DataQualityBatchRunItem, { status: 'ERROR' }>[]
): string {
  if (failedItems.length === 0) return t('dataQualityBatch.noFailureDetails');
  const messages = Array.from(new Set(failedItems.map(item => item.message)));
  if (messages.length === 1) {
    return t('dataQualityBatch.failedWithMessage', {
      count: failedItems.length,
      message: messages[0],
    });
  }
  const counts = new Map<string, number>();
  failedItems.forEach(item => counts.set(item.code, (counts.get(item.code) ?? 0) + 1));
  return t('dataQualityBatch.failedWithCodes', {
    count: failedItems.length,
    codes: Array.from(counts, ([code, count]) => `${code}: ${String(count)}`).join(', '),
  });
}

function getErrorMessage(t: ReturnType<typeof useTranslation>['t'], error: unknown): string {
  return error instanceof Error && error.message ? error.message : t('common.tryAgain');
}
