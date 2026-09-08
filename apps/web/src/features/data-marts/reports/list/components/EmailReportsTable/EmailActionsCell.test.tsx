// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { MouseEventHandler, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmailActionsCell } from './EmailActionsCell';
import type { DataMartReport } from '../../../shared/model/types/data-mart-report';

const runReport = vi.fn();
const onRunSuccess = vi.fn();

vi.mock('@owox/ui/components/dropdown-menu', () => {
  const passthrough = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    DropdownMenu: passthrough,
    DropdownMenuTrigger: passthrough,
    DropdownMenuContent: passthrough,
    DropdownMenuSeparator: () => null,
    DropdownMenuItem: ({
      children,
      onClick,
      disabled,
    }: {
      children?: ReactNode;
      onClick?: MouseEventHandler<HTMLButtonElement>;
      disabled?: boolean;
    }) => (
      <button type='button' disabled={disabled} onClick={onClick}>
        {children}
      </button>
    ),
  };
});

vi.mock('../../../shared', () => ({
  ReportStatusEnum: {
    RUNNING: 'RUNNING',
  },
  useReport: () => ({
    deleteReport: vi.fn(),
    fetchReportsByDataMartId: vi.fn(),
    runReport,
  }),
}));

describe('EmailActionsCell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('releases the optimistic running state when the run does not start', async () => {
    runReport.mockResolvedValue(false);
    render(<EmailActionsCell row={{ original: buildReport() }} onRunSuccess={onRunSuccess} />);

    fireEvent.click(screen.getByRole('button', { name: 'Run report' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Run report' })).not.toBeDisabled();
    });
    expect(runReport).toHaveBeenCalledWith('report-1');
    expect(onRunSuccess).not.toHaveBeenCalled();
  });
});

function buildReport(): DataMartReport {
  return {
    id: 'report-1',
    title: 'Revenue',
    lastRunStatus: 'SUCCESS',
    canRun: true,
    canEditConfig: true,
    dataMart: { id: 'dm-1' },
  } as unknown as DataMartReport;
}
