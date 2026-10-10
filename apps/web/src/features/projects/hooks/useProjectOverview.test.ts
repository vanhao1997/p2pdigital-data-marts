import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useProjectOverview } from './useProjectOverview';

const mocks = vi.hoisted(() => ({
  user: { id: 'user-a' } as { id: string } | null,
  query: vi.fn(),
  get: vi.fn(),
}));
vi.mock('@tanstack/react-query', () => ({ useQuery: mocks.query }));
vi.mock('../../idp/hooks/useAuthState', () => ({ useUser: () => mocks.user }));
vi.mock('../services/project-overview.service', () => ({ getProjectOverview: mocks.get }));

describe('useProjectOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = { id: 'user-a' };
  });

  it('isolates its cache by user and project and refreshes every 15 seconds', () => {
    renderHook(() => useProjectOverview('project-b'));
    expect(mocks.query).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['project-overview', 'user-a', 'project-b'],
        enabled: true,
        refetchInterval: 15_000,
        retry: false,
        gcTime: 0,
      })
    );
  });

  it('does not fetch after logout', () => {
    mocks.user = null;
    renderHook(() => useProjectOverview('project-b'));
    expect(mocks.query).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
  });

  it('passes the project and cancellation signal through to the transport', async () => {
    renderHook(() => useProjectOverview('project-b'));
    const options = mocks.query.mock.calls[0][0] as {
      queryFn: (args: { signal: AbortSignal }) => Promise<unknown>;
    };
    const signal = new AbortController().signal;
    await options.queryFn({ signal });
    expect(mocks.get).toHaveBeenCalledWith('project-b', signal);
  });
});
