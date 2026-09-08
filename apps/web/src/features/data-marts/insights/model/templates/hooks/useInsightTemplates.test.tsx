import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { insightTemplatesService } from '../services/insight-templates.service';
import type { InsightTemplateListResponseDto } from '../types/insight-templates.dto';
import { useInsightTemplates } from './useInsightTemplates';

vi.mock('../services/insight-templates.service', () => ({
  insightTemplatesService: { getInsightTemplates: vi.fn() },
}));

describe('useInsightTemplates', () => {
  it('aborts the old request and ignores its late response after switching Data Mart', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    let resolveOld!: (value: InsightTemplateListResponseDto) => void;
    let oldSignal: AbortSignal | undefined;
    vi.mocked(insightTemplatesService.getInsightTemplates).mockImplementation((id, signal) => {
      if (id === 'old') {
        oldSignal = signal;
        return new Promise(resolve => {
          resolveOld = resolve;
        });
      }
      return Promise.resolve({ data: [] });
    });
    const { result, rerender, unmount } = renderHook(({ id }) => useInsightTemplates(id), {
      initialProps: { id: 'old' },
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });
    await waitFor(() => { expect(oldSignal).toBeDefined(); });
    rerender({ id: 'new' });
    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });
    expect(oldSignal?.aborted).toBe(true);
    await act(async () =>
      { resolveOld({
        data: [
          {
            id: 'stale',
            title: 'Old template',
            createdById: 'user',
            sourcesCount: 0,
            createdAt: '2026-01-01',
            modifiedAt: '2026-01-01',
            lastRenderedTemplateUpdatedAt: null,
          },
        ],
      }); }
    );
    expect(result.current.data).toEqual([]);
    unmount();
    client.clear();
  });
});
