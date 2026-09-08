import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import i18n from '../../../../i18n';
import { TaskStatus } from '../../../../shared/types/task-status.enum.ts';
import { buildPublishFailureMessage } from '../utils/buildPublishFailureMessage.ts';
import { dataStorageApiService } from '../api';

interface UsePublishDraftsTriggerReturn {
  run: (dataStorageId: string) => Promise<void>;
  isLoading: boolean;
  cancel: () => Promise<void>;
  error: string | null;
}

const POLLING_INTERVAL = 1000;

/**
 * A trigger that finished in ERROR state comes back as HTTP 400 whose body
 * still carries the backend's allowlisted `error` text — and the backend
 * deletes the trigger row on that read, so this is the only chance to show
 * the reason. Prefer it over Axios's generic "Request failed with status
 * code 400".
 */
function extractServerReportedError(e: unknown): string | null {
  const data = (e as { response?: { data?: { error?: unknown } } } | null)?.response?.data;
  return typeof data?.error === 'string' && data.error.length > 0 ? data.error : null;
}

function isCancellationError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; name?: unknown };
  return (
    candidate.code === 'ERR_CANCELED' ||
    candidate.name === 'AbortError' ||
    candidate.name === 'CanceledError'
  );
}

export function usePublishDraftsTrigger(onSuccess?: () => void): UsePublishDraftsTriggerReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentTriggerIdRef = useRef<string | null>(null);
  const currentDataStorageIdRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const isMountedRef = useRef<boolean>(true);

  const onSuccessRef = useRef<typeof onSuccess>(onSuccess);
  onSuccessRef.current = onSuccess;

  const setSafeLoading = useCallback((val: boolean) => {
    if (isMountedRef.current) setIsLoading(val);
  }, []);
  const setSafeError = useCallback((val: string | null) => {
    if (isMountedRef.current) setError(val);
  }, []);

  const handleError = useCallback(
    (e: unknown, triggerId: string) => {
      const errorMessage =
        extractServerReportedError(e) ??
        (e instanceof Error ? e.message : i18n.t('uiFeedback.draftsPublishFailed'));
      toast.dismiss(triggerId);
      setSafeError(errorMessage);
      setSafeLoading(false);
      currentTriggerIdRef.current = null;
      currentDataStorageIdRef.current = null;
      abortControllerRef.current = null;
      toast.error(errorMessage, { duration: undefined, id: triggerId });
    },
    [setSafeError, setSafeLoading]
  );

  const cancel = useCallback(async (): Promise<void> => {
    const triggerId = currentTriggerIdRef.current;
    const storageId = currentDataStorageIdRef.current;

    abortControllerRef.current?.abort();

    if (triggerId && storageId) {
      toast.dismiss(triggerId);
      try {
        await dataStorageApiService.abortPublishDraftsTrigger(storageId, triggerId);
      } catch {
        // ignore server abort errors
      }
    }

    currentTriggerIdRef.current = null;
    currentDataStorageIdRef.current = null;
    abortControllerRef.current = null;
    setSafeLoading(false);
  }, [setSafeLoading]);

  const pollTriggerStatus = useCallback(
    async (dataStorageId: string, triggerId: string, signal: AbortSignal): Promise<void> => {
      const isFinal = (status: TaskStatus): boolean =>
        status === TaskStatus.SUCCESS ||
        status === TaskStatus.ERROR ||
        status === TaskStatus.CANCELLED;

      while (!signal.aborted && currentTriggerIdRef.current === triggerId) {
        try {
          const status = await dataStorageApiService.getPublishDraftsTriggerStatus(
            dataStorageId,
            triggerId,
            { signal }
          );

          if (isFinal(status)) {
            try {
              const response = await dataStorageApiService.getPublishDraftsTriggerResponse(
                dataStorageId,
                triggerId,
                { signal }
              );

              toast.dismiss(triggerId);

              if (response.error) {
                setSafeError(response.error);
                toast.error(response.error, { duration: undefined, id: `${triggerId}-error` });
              } else {
                if (response.successCount > 0) {
                  toast.success(
                    i18n.t('uiFeedback.draftsPublished', { count: response.successCount }),
                    { duration: 10000, id: `${triggerId}-success` }
                  );
                }

                if (response.failedCount > 0) {
                  toast.error(
                    buildPublishFailureMessage(response.failedCount, response.failureReasons ?? []),
                    { duration: 10000, id: `${triggerId}-error` }
                  );
                }

                if (response.successCount === 0 && response.failedCount === 0) {
                  toast.success(i18n.t('uiFeedback.noDraftsToPublish'), {
                    duration: 5000,
                    id: triggerId,
                  });
                }

                onSuccessRef.current?.();
              }
            } catch (e) {
              if (!isCancellationError(e)) {
                handleError(e, triggerId);
              }
            }

            setSafeLoading(false);
            currentTriggerIdRef.current = null;
            currentDataStorageIdRef.current = null;
            abortControllerRef.current = null;
            return;
          }

          await new Promise<void>(resolve => {
            if (signal.aborted) {
              resolve();
              return;
            }

            const finish = () => {
              clearTimeout(timeoutId);
              signal.removeEventListener('abort', finish);
              resolve();
            };
            const timeoutId = setTimeout(finish, POLLING_INTERVAL);
            signal.addEventListener('abort', finish, { once: true });
          });
        } catch (e) {
          if (isCancellationError(e)) {
            return;
          }
          handleError(e, triggerId);
          return;
        }
      }
    },
    [setSafeError, setSafeLoading, handleError]
  );

  const run = useCallback(
    async (dataStorageId: string) => {
      if (currentTriggerIdRef.current) await cancel();

      setSafeError(null);
      setSafeLoading(true);

      try {
        const { triggerId } = await dataStorageApiService.createPublishDraftsTrigger(dataStorageId);

        toast.loading(i18n.t('uiFeedback.draftsPublishStarted'), {
          duration: Infinity,
          id: triggerId,
        });

        currentTriggerIdRef.current = triggerId;
        currentDataStorageIdRef.current = dataStorageId;
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        try {
          await pollTriggerStatus(dataStorageId, triggerId, abortController.signal);
        } catch (e) {
          if (!isCancellationError(e)) {
            handleError(e, triggerId);
          }
        }
      } catch (e) {
        setSafeLoading(false);
        setSafeError(
          e instanceof Error ? e.message : i18n.t('uiFeedback.draftsPublishStartFailed')
        );
      }
    },
    [cancel, pollTriggerStatus, setSafeError, setSafeLoading, handleError]
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;

      const triggerId = currentTriggerIdRef.current;
      const storageId = currentDataStorageIdRef.current;
      abortControllerRef.current?.abort();

      if (triggerId && storageId) {
        toast.dismiss(triggerId);
        dataStorageApiService
          .abortPublishDraftsTrigger(storageId, triggerId)
          .catch(() => undefined);
      }

      currentTriggerIdRef.current = null;
      currentDataStorageIdRef.current = null;
      abortControllerRef.current = null;
    };
  }, []);

  return { run, isLoading, cancel, error };
}
