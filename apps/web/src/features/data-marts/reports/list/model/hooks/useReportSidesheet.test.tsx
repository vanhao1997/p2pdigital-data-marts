import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter, useSearchParams } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { DataMartReport } from '../../../shared/model/types/data-mart-report';
import { REPORT_ID_URL_PARAM, useReportSidesheet } from './useReportSidesheet';

const report = {
  id: 'report-1',
  title: 'Weekly report',
  dataMart: { id: 'mart-1', title: 'Mart' },
  dataDestination: { id: 'destination-1', type: 'GOOGLE_SHEETS' },
} as unknown as DataMartReport;

function createWrapper(initialEntry: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>;
  };
}

function renderSidesheetHook(initialEntry: string, deepLinkReports?: DataMartReport[]) {
  return renderHook(
    () => {
      const [searchParams, setSearchParams] = useSearchParams();
      return {
        sidesheet: useReportSidesheet(deepLinkReports ? { deepLinkReports } : undefined),
        searchParams,
        setSearchParams,
      };
    },
    { wrapper: createWrapper(initialEntry) }
  );
}

describe('useReportSidesheet deep linking', () => {
  it('auto-opens the sidesheet for a matching reportId query param', () => {
    const { result } = renderSidesheetHook(
      '/ui/project-1/data-marts/mart-1/reports?reportId=report-1',
      [report]
    );

    expect(result.current.sidesheet.isOpen).toBe(true);
    expect(result.current.sidesheet.editingReport?.id).toBe('report-1');
  });

  it('does not open the sidesheet when the reportId param matches none of the reports', () => {
    const { result } = renderSidesheetHook(
      '/ui/project-1/data-marts/mart-1/reports?reportId=unknown',
      [report]
    );

    expect(result.current.sidesheet.isOpen).toBe(false);
  });

  it('syncs the reportId param with open/close actions', () => {
    const { result } = renderSidesheetHook('/ui/project-1/data-marts/mart-1/reports', [report]);

    act(() => {
      result.current.sidesheet.handleEditReport(report);
    });
    expect(result.current.searchParams.get(REPORT_ID_URL_PARAM)).toBe('report-1');

    act(() => {
      result.current.sidesheet.handleCloseModal();
    });
    expect(result.current.searchParams.get(REPORT_ID_URL_PARAM)).toBeNull();
    expect(result.current.sidesheet.isOpen).toBe(false);
  });

  it('does not reopen the sidesheet from the same param after it was closed', () => {
    const { result } = renderSidesheetHook(
      '/ui/project-1/data-marts/mart-1/reports?reportId=report-1',
      [report]
    );

    act(() => {
      result.current.sidesheet.handleCloseModal();
    });

    expect(result.current.sidesheet.isOpen).toBe(false);
    expect(result.current.searchParams.get(REPORT_ID_URL_PARAM)).toBeNull();
  });

  it('closes the edit from a callback retained before reportId navigation', async () => {
    const { result } = renderSidesheetHook('/ui/project-1/data-marts/mart-1/reports', [report]);
    const retainedClose = result.current.sidesheet.handleCloseModal;
    let finishSave!: () => void;
    const pendingSave = new Promise<void>(resolve => {
      finishSave = resolve;
    });
    const closeAfterSave = pendingSave.then(retainedClose);

    act(() => {
      result.current.sidesheet.handleEditReport(report);
    });
    expect(result.current.sidesheet.isOpen).toBe(true);
    expect(result.current.searchParams.get(REPORT_ID_URL_PARAM)).toBe('report-1');

    await act(async () => {
      finishSave();
      await closeAfterSave;
    });

    expect(result.current.sidesheet.isOpen).toBe(false);
    expect(result.current.sidesheet.editingReport).toBeNull();
    expect(result.current.searchParams.get(REPORT_ID_URL_PARAM)).toBeNull();
  });

  it('keeps another report deep link when a retained edit close callback completes', () => {
    const { result } = renderSidesheetHook('/ui/project-1/data-marts/mart-1/reports', [report]);
    act(() => {
      result.current.sidesheet.handleEditReport(report);
    });
    const retainedClose = result.current.sidesheet.handleCloseModal;

    act(() => {
      result.current.setSearchParams({ [REPORT_ID_URL_PARAM]: 'other-report' });
    });
    act(() => {
      retainedClose();
    });

    expect(result.current.sidesheet.isOpen).toBe(false);
    expect(result.current.searchParams.get(REPORT_ID_URL_PARAM)).toBe('other-report');
  });

  it('opens a deep link that arrives after a previous sidesheet was closed', () => {
    const { result } = renderSidesheetHook(
      '/ui/project-1/data-marts/mart-1/reports?reportId=report-1',
      [report]
    );

    act(() => {
      result.current.sidesheet.handleCloseModal();
    });
    expect(result.current.sidesheet.isOpen).toBe(false);

    act(() => {
      result.current.setSearchParams({ [REPORT_ID_URL_PARAM]: 'report-1' });
    });

    expect(result.current.sidesheet.isOpen).toBe(true);
    expect(result.current.sidesheet.editingReport?.id).toBe('report-1');
  });

  it('keeps a pending deep link when an unrelated create sidesheet is closed', () => {
    // This instance's list does not contain the deep-linked report (it belongs to
    // another destination card), so closing a create sheet here must not strip it.
    const { result } = renderSidesheetHook(
      '/ui/project-1/data-marts/mart-1/reports?reportId=report-1',
      []
    );

    act(() => {
      result.current.sidesheet.handleAddReport();
    });
    act(() => {
      result.current.sidesheet.handleCloseModal();
    });

    expect(result.current.searchParams.get(REPORT_ID_URL_PARAM)).toBe('report-1');
  });

  it('leaves the URL untouched when deep linking is not enabled', () => {
    const { result } = renderSidesheetHook('/ui/project-1/data-marts/reports');

    act(() => {
      result.current.sidesheet.handleEditReport(report);
    });

    expect(result.current.sidesheet.isOpen).toBe(true);
    expect(result.current.searchParams.get(REPORT_ID_URL_PARAM)).toBeNull();
  });
});
