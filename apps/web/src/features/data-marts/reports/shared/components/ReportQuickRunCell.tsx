import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, Play } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@owox/ui/components/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@owox/ui/components/tooltip';
import type { DataMartReport } from '../model/types/data-mart-report';
import { ReportStatusEnum } from '../enums';
import { useReport } from '../model';
import { RunUndoToast } from './RunUndoToast';
import { DataDestinationType, pullBasedRunHint } from '../../../../data-destination/shared/enums';
import { useTranslation } from 'react-i18next';

const GRACE_PERIOD_MS = 3000;

interface ReportQuickRunCellProps {
  report: DataMartReport;
  onRunSuccess?: () => void | Promise<void>;
}

export function ReportQuickRunCell({ report, onRunSuccess }: ReportQuickRunCellProps) {
  const { t } = useTranslation();
  const canRun = report.canRun;
  const [isRunning, setIsRunning] = useState(report.lastRunStatus === ReportStatusEnum.RUNNING);
  const [isPending, setIsPending] = useState(false);
  const [isOptimisticRunning, setIsOptimisticRunning] = useState(false);
  const { runReport } = useReport();

  useEffect(() => {
    const running = report.lastRunStatus === ReportStatusEnum.RUNNING;
    setIsRunning(running);
    if (running) {
      setIsOptimisticRunning(false);
    }
  }, [report.lastRunStatus]);

  const mountedRef = useRef(true);
  const hasRunRef = useRef(false);
  const toastIdRef = useRef<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (toastIdRef.current) {
        toast.dismiss(toastIdRef.current);
        toastIdRef.current = null;
      }
    };
  }, []);

  const executeRun = useCallback(async () => {
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    if (toastIdRef.current) {
      toast.dismiss(toastIdRef.current);
      toastIdRef.current = null;
    }

    setIsPending(false);
    setIsOptimisticRunning(true);

    try {
      await runReport(report.id);
      if (onRunSuccess) await onRunSuccess();
    } catch (error) {
      console.error('Failed to run report:', error);
    } finally {
      if (mountedRef.current) {
        setIsOptimisticRunning(false);
      }
    }
  }, [runReport, report.id, onRunSuccess]);

  const handleRun = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!canRun || isPending || isRunning || isOptimisticRunning) return;

      hasRunRef.current = false;
      setIsPending(true);

      const toastId = String(Date.now());
      toast.custom(
        () => (
          <RunUndoToast
            toastId={toastId}
            reportName={report.title}
            gracePeriodMs={GRACE_PERIOD_MS}
            onConfirm={executeRun}
            onCancel={() => {
              if (hasRunRef.current) return;
              if (mountedRef.current) {
                setIsPending(false);
              }
            }}
          />
        ),
        { id: toastId, duration: Infinity, position: 'bottom-center' }
      );

      toastIdRef.current = toastId;
    },
    [canRun, isPending, isRunning, isOptimisticRunning, executeRun, report.title]
  );

  const isActive = isPending || isRunning || isOptimisticRunning;
  // Disabled here is not a missing permission: nobody can start such a run, so the button says
  // what to do instead. Same sentence as the dropdown item, from the same place.
  const pullRunHint = pullBasedRunHint(report.dataDestination.type);
  const localizedPullRunHint =
    report.dataDestination.type === DataDestinationType.EXCEL
      ? t('reportsUi.pullRunHintExcel', 'Refresh it from The P2PDigital add-in in Excel')
      : report.dataDestination.type === DataDestinationType.LOOKER_STUDIO
        ? t('reportsUi.pullRunHintDestination', 'The destination reads this report itself')
        : pullRunHint;
  const tooltipText = isPending
    ? t('reportsUi.startingSoon', 'Starting soon…')
    : isRunning || isOptimisticRunning
      ? t('reportsUi.reportRunning', 'Report is running…')
      : (localizedPullRunHint ?? t('reportActions.run', 'Run report'));

  return (
    <TooltipProvider>
      <div className='flex h-full w-full items-center justify-center'>
        <Tooltip>
          {/* The span wraps the button so Radix keeps a hoverable target: the shared Button
              carries `disabled:pointer-events-none`, and a disabled one would swallow the hover
              — exactly when the hint matters most, because the button is disabled for a reason
              no permission explains. Same wrapping as MembersTable. */}
          <TooltipTrigger asChild>
            <span className='inline-block'>
              <Button
                onClick={handleRun}
                variant='ghost'
                className='dm-card-table-body-row-actionbtn cursor-pointer transition-all disabled:opacity-30'
                disabled={!canRun || isActive}
                aria-label={
                  isActive
                    ? tooltipText
                    : (localizedPullRunHint ??
                      `${t('reportActions.run', 'Run report')}: ${report.title}`)
                }
              >
                {isPending ? (
                  <Loader2 className='h-4 w-4 animate-spin' aria-hidden='true' />
                ) : (
                  <Play className='text-muted-foreground h-4 w-4' aria-hidden='true' />
                )}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent side='bottom' role='tooltip'>
            {tooltipText}
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
