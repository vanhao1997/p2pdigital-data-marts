import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { toast } from 'sonner';
import { TaskStatus } from '../../../../shared/types/task-status.enum.ts';
import { dataStorageApiService } from '../api';
import { usePublishDraftsTrigger } from './usePublishDraftsTrigger.ts';

vi.mock('sonner', () => ({
  default: { error: vi.fn(), success: vi.fn(), loading: vi.fn(), dismiss: vi.fn() },
  toast: { error: vi.fn(), success: vi.fn(), loading: vi.fn(), dismiss: vi.fn() },
}));

vi.mock('../api', () => ({
  dataStorageApiService: {
    createPublishDraftsTrigger: vi.fn(),
    getPublishDraftsTriggerStatus: vi.fn(),
    getPublishDraftsTriggerResponse: vi.fn(),
    abortPublishDraftsTrigger: vi.fn(),
  },
}));

const SAFE_TRIGGER_ERROR =
  'Could not determine your project permissions. No Data Mart drafts were published.';

/** Shape of the AxiosError produced when the backend returns the trigger as HTTP 400. */
function axios400(body: Record<string, unknown>): Error {
  return Object.assign(new Error('Request failed with status code 400'), {
    response: { data: body },
  });
}

describe('usePublishDraftsTrigger — terminal ERROR trigger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dataStorageApiService.createPublishDraftsTrigger).mockResolvedValue({
      triggerId: 't1',
    });
    vi.mocked(dataStorageApiService.getPublishDraftsTriggerStatus).mockResolvedValue(
      TaskStatus.ERROR
    );
  });

  // The backend deletes an ERROR trigger on read and returns it as HTTP 400,
  // so the allowlisted reason in the body is the only chance to inform the user.
  it('shows the backend-reported reason instead of the raw Axios message', async () => {
    vi.mocked(dataStorageApiService.getPublishDraftsTriggerResponse).mockRejectedValue(
      axios400({
        successCount: 0,
        failedCount: 0,
        error: SAFE_TRIGGER_ERROR,
        statusCode: 400,
        message: 'Bad Request Exception',
      })
    );

    const { result } = renderHook(() => usePublishDraftsTrigger());
    await act(async () => {
      await result.current.run('storage-1');
    });

    expect(toast.error).toHaveBeenCalledWith(SAFE_TRIGGER_ERROR, expect.objectContaining({}));
    expect(result.current.error).toBe(SAFE_TRIGGER_ERROR);
  });

  it('falls back to the Axios message when the 400 body carries no error field', async () => {
    vi.mocked(dataStorageApiService.getPublishDraftsTriggerResponse).mockRejectedValue(
      axios400({ statusCode: 400, message: 'Request was cancelled by user' })
    );

    const { result } = renderHook(() => usePublishDraftsTrigger());
    await act(async () => {
      await result.current.run('storage-1');
    });

    expect(result.current.error).toBe('Request failed with status code 400');
  });

  // The common path today: the runner overwrites ERROR with SUCCESS, so the
  // reason arrives on a 200 response via uiResponse.error.
  it('still shows the reason when it arrives on a successful response', async () => {
    vi.mocked(dataStorageApiService.getPublishDraftsTriggerStatus).mockResolvedValue(
      TaskStatus.SUCCESS
    );
    vi.mocked(dataStorageApiService.getPublishDraftsTriggerResponse).mockResolvedValue({
      successCount: 0,
      failedCount: 0,
      error: SAFE_TRIGGER_ERROR,
    });

    const { result } = renderHook(() => usePublishDraftsTrigger());
    await act(async () => {
      await result.current.run('storage-1');
    });

    expect(toast.error).toHaveBeenCalledWith(
      SAFE_TRIGGER_ERROR,
      expect.objectContaining({ id: 't1-error' })
    );
    expect(result.current.error).toBe(SAFE_TRIGGER_ERROR);
  });

  it('aborts polling and requests server cancellation without showing an error', async () => {
    vi.mocked(dataStorageApiService.getPublishDraftsTriggerStatus).mockResolvedValue(
      TaskStatus.PROCESSING
    );
    vi.mocked(dataStorageApiService.abortPublishDraftsTrigger).mockResolvedValue(undefined);

    const { result } = renderHook(() => usePublishDraftsTrigger());
    let runPromise: Promise<void> | undefined;

    await act(async () => {
      runPromise = result.current.run('storage-1');
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(dataStorageApiService.getPublishDraftsTriggerStatus).toHaveBeenCalledWith(
      'storage-1',
      't1',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );

    await act(async () => {
      await result.current.cancel();
      await runPromise;
    });

    expect(dataStorageApiService.abortPublishDraftsTrigger).toHaveBeenCalledWith('storage-1', 't1');
    expect(toast.error).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });

  it('removes the wait listener after each polling interval', async () => {
    vi.useFakeTimers();
    const removeListener = vi.spyOn(AbortSignal.prototype, 'removeEventListener');
    vi.mocked(dataStorageApiService.getPublishDraftsTriggerStatus)
      .mockResolvedValueOnce(TaskStatus.PROCESSING)
      .mockResolvedValue(TaskStatus.SUCCESS);
    vi.mocked(dataStorageApiService.getPublishDraftsTriggerResponse).mockResolvedValue({
      successCount: 1,
      failedCount: 0,
    });
    try {
      const { result } = renderHook(() => usePublishDraftsTrigger());
      await act(async () => {
        const run = result.current.run('storage-1');
        await vi.advanceTimersByTimeAsync(1000);
        await run;
      });
      expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function));
      expect(result.current.isLoading).toBe(false);
    } finally {
      removeListener.mockRestore();
      vi.useRealTimers();
    }
  });
});
