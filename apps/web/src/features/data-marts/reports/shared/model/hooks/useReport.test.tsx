// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportsProvider } from '../context';
import { useReport } from './useReport';

const mocks = vi.hoisted(() => ({
  deleteReport: vi.fn(),
  getReportsByDataMartId: vi.fn(),
  trackEvent: vi.fn(),
}));

vi.mock('../../services', () => ({
  reportService: {
    deleteReport: mocks.deleteReport,
    getReportsByDataMartId: mocks.getReportsByDataMartId,
  },
  reportStatusPollingService: {
    stopAllPolling: vi.fn(),
    stopPolling: vi.fn(),
    startPolling: vi.fn(),
    setConfig: vi.fn(),
  },
}));

vi.mock('../mappers', () => ({
  mapReportDtoToEntity: (value: unknown) => value,
}));

vi.mock('../../../../../data-destination', () => ({
  dataDestinationService: {},
}));

vi.mock('../../../../../../components/AppSidebar/SetupChecklist/useSetupProgress', () => ({
  useRefreshSetupProgress: () => vi.fn(),
}));

vi.mock('../../../../../../utils', () => ({
  trackEvent: mocks.trackEvent,
}));

vi.mock('sonner', () => ({
  default: { success: vi.fn() },
  toast: { success: vi.fn() },
}));

const wrapper = ({ children }: PropsWithChildren) => <ReportsProvider>{children}</ReportsProvider>;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(promiseResolve => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

describe('useReport delete contract', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects a failed delete so callers do not continue as if it succeeded', async () => {
    const error = new Error('delete failed');
    mocks.deleteReport.mockRejectedValue(error);
    const { result } = renderHook(() => useReport(), { wrapper });

    await act(async () => {
      await expect(result.current.deleteReport('report-1')).rejects.toBe(error);
    });

    expect(result.current.error).toBe('delete failed');
    expect(mocks.trackEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DeleteError', error: 'delete failed' })
    );
  });

  it('keeps the newest report list when refresh responses arrive out of order', async () => {
    const first = deferred<unknown[]>();
    const second = deferred<unknown[]>();
    mocks.getReportsByDataMartId
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result } = renderHook(
      () => ({ firstConsumer: useReport(), secondConsumer: useReport() }),
      { wrapper }
    );

    let firstRequest!: Promise<boolean>;
    let secondRequest!: Promise<boolean>;
    act(() => {
      firstRequest = result.current.firstConsumer.fetchReportsByDataMartId('data-mart-1');
      secondRequest = result.current.secondConsumer.fetchReportsByDataMartId('data-mart-1');
    });

    await act(async () => {
      second.resolve([{ id: 'new-report' }]);
      await secondRequest;
      first.resolve([{ id: 'stale-report' }]);
      await firstRequest;
    });

    expect(result.current.firstConsumer.reports).toEqual([{ id: 'new-report' }]);
  });

  it('passes polling cancellation through to the report service', async () => {
    const signal = new AbortController().signal;
    mocks.getReportsByDataMartId.mockResolvedValueOnce([]);
    const { result } = renderHook(() => useReport(), { wrapper });

    await act(async () => {
      await result.current.fetchReportsByDataMartId('data-mart-1', { silent: true, signal });
    });

    expect(mocks.getReportsByDataMartId).toHaveBeenCalledWith('data-mart-1', {
      skipLoadingIndicator: true,
      skipErrorToast: true,
      signal,
    });
  });
});
