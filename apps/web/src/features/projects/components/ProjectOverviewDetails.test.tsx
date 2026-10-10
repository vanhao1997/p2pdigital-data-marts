import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, beforeEach, expect } from 'vitest';
import { DataMartStatus } from '../../data-marts/shared/enums';
import { ProjectOverviewDetails } from './ProjectOverviewDetails';

const query = vi.hoisted(() => ({ value: {} as Record<string, unknown>, hook: vi.fn() }));
vi.mock('../hooks/useProjectOverview', () => ({
  useProjectOverview: (id: string) => {
    query.hook(id);
    return query.value;
  },
}));

describe('ProjectOverviewDetails', () => {
  beforeEach(() => {
    query.hook.mockClear();
    query.value = {
      isPending: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
      data: {
        projectId: 'project-b',
        dataMartsCount: 6,
        runningSyncsCount: 2,
        connectors: [
          { name: 'Admicro', dataMartsCount: 3 },
          { name: 'FacebookAds', dataMartsCount: 1 },
        ],
        dataMarts: [{ id: 'mart-b', title: 'Revenue mart', status: DataMartStatus.DRAFT }],
        observedAt: '2026-10-10T00:00:00Z',
      },
    };
  });

  it('shows provider names, per-provider counts, Data Mart status and exact metrics', () => {
    render(<ProjectOverviewDetails projectId='project-b' disabled={false} onOpen={vi.fn()} />);
    expect(query.hook).toHaveBeenCalledWith('project-b');
    expect(screen.getByText('Revenue mart')).toBeVisible();
    expect(screen.getByText('Draft')).toBeVisible();
    expect(screen.getByText('Admicro')).toBeVisible();
    expect(screen.getByText('(3)')).toBeVisible();
    expect(screen.getByText('6')).toBeVisible();
    expect(screen.getByText('Running syncs')).toBeVisible();
    expect(screen.getByRole('button', { name: /View all/ })).toHaveTextContent('+5 more');
  });

  it('opens Data Mart details and the complete list through project selection', () => {
    const open = vi.fn();
    render(<ProjectOverviewDetails projectId='project-b' disabled={false} onOpen={open} />);
    fireEvent.click(screen.getByRole('button', { name: 'Revenue mart' }));
    expect(open).toHaveBeenCalledWith('/data-marts/mart-b/overview');
    fireEvent.click(screen.getByRole('button', { name: /View all/ }));
    expect(open).toHaveBeenCalledWith('/data-marts');
  });

  it('disables drilldowns while project selection is pending', () => {
    render(<ProjectOverviewDetails projectId='project-b' disabled onOpen={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Revenue mart' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /View all/ })).toBeDisabled();
  });

  it('does not show stale data or a false zero when refresh fails; offers retry', () => {
    query.value.isError = true;
    render(<ProjectOverviewDetails projectId='project-b' disabled={false} onOpen={vi.fn()} />);
    expect(screen.getByText('Project details unavailable')).toBeVisible();
    expect(screen.queryByText('Revenue mart')).not.toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh project details' }));
    expect(query.value.refetch).toHaveBeenCalled();
  });

  it('shows initial loading without fabricating counters', () => {
    query.value = { isPending: true };
    render(<ProjectOverviewDetails projectId='project-b' disabled={false} onOpen={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading...');
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('distinguishes a successfully loaded empty project', () => {
    query.value.data = { dataMartsCount: 0, runningSyncsCount: 0, connectors: [], dataMarts: [] };
    render(<ProjectOverviewDetails projectId='project-b' disabled={false} onOpen={vi.fn()} />);
    expect(screen.getByText('No visible Data Marts')).toBeVisible();
    expect(screen.getByText('No connectors configured')).toBeVisible();
    expect(screen.getAllByText('0')).toHaveLength(3);
  });
});
