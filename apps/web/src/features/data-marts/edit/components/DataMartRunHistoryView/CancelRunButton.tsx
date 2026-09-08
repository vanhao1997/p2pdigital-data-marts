import { useCallback, useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@owox/ui/components/button';
import { ConfirmationDialog } from '../../../../../shared/components/ConfirmationDialog';
import { cn } from '@owox/ui/lib/utils';
import { useTranslation } from 'react-i18next';
import i18n from '../../../../../i18n';

function getErrorResponse(error: unknown):
  | {
      status?: number;
      data?: {
        message?: unknown;
      };
    }
  | undefined {
  return (
    error as {
      response?: {
        status?: number;
        data?: {
          message?: unknown;
        };
      };
    }
  ).response;
}

function getCancelErrorMessage(error: unknown): string {
  const responseMessage = getErrorResponse(error)?.data?.message;
  if (typeof responseMessage === 'string' && responseMessage.length > 0) {
    return responseMessage;
  }

  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return i18n.t('runHistory.cancelFailed');
}

interface CancelRunButtonProps {
  runId: string;
  dataMartId: string;
  cancelDataMartRun: (id: string, runId: string) => Promise<void>;
  className?: string;
  variant?: 'destructive' | 'secondary';
  iconClassName?: string;
  labelClassName?: string;
  isDataQuality?: boolean;
}

export function CancelRunButton({
  runId,
  dataMartId,
  cancelDataMartRun,
  className,
  variant = 'secondary',
  iconClassName = 'size-3',
  labelClassName = 'hidden sm:inline',
  isDataQuality = false,
}: CancelRunButtonProps) {
  const { t } = useTranslation();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const handleOpenConfirm = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setIsConfirmOpen(true);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (isCancelling) return;

    setIsCancelling(true);
    try {
      await cancelDataMartRun(dataMartId, runId);
      setIsConfirmOpen(false);
    } catch (error) {
      toast.error(getCancelErrorMessage(error));
    } finally {
      setIsCancelling(false);
    }
  }, [cancelDataMartRun, dataMartId, isCancelling, runId]);

  return (
    <>
      <Button
        variant={variant}
        size='sm'
        aria-label={t('runHistory.cancelRun', 'Cancel run')}
        onClick={handleOpenConfirm}
        disabled={isCancelling}
        className={cn(
          'cursor-pointer font-medium',
          variant === 'secondary' &&
            'hover:bg-muted hover:text-foreground dark:hover:text-foreground text-xs dark:hover:bg-white/10',
          className
        )}
      >
        <X className={iconClassName} />
        <span className={labelClassName}>
          {isCancelling ? t('runHistory.cancelling', 'Cancelling') : t('common.cancel', 'Cancel')}
        </span>
      </Button>

      <ConfirmationDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        title={t('runHistory.cancelRunQuestion', 'Cancel run?')}
        description={
          isDataQuality
            ? t(
                'runHistory.cancelQualityDescription',
                'This stops the Data Quality run between checks. Results already completed will remain available.'
              )
            : t(
                'runHistory.cancelDescription',
                'This will request cancellation and stop the run if it is still in progress. Cancelling a run may result in incomplete data.'
              )
        }
        confirmLabel={t('runHistory.cancelRun', 'Cancel run')}
        cancelLabel={t('runHistory.keepRunning', 'Keep running')}
        confirmDisabled={isCancelling}
        onConfirm={() => {
          void handleConfirm();
        }}
        variant='destructive'
      />
    </>
  );
}
