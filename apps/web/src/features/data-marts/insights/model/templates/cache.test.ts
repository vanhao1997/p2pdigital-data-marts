import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InsightTemplateEntity } from './types/insight-template.entity';
import { INSIGHT_TEMPLATES_QUERY_KEY } from './hooks/useInsightTemplates';
import { removeInsightTemplateFromListCache } from './cache';

function buildItem(id: string): InsightTemplateEntity {
  return {
    id,
    title: id,
    template: null,
    sources: [],
    sourcesCount: 0,
    lastRenderedTemplate: null,
    lastRenderedTemplateUpdatedAt: null,
    lastRun: null,
    createdById: 'user-1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    modifiedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}

describe('removeInsightTemplateFromListCache', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('cancels, removes the deleted row immediately, and invalidates the list', async () => {
    const queryKey = [INSIGHT_TEMPLATES_QUERY_KEY, 'data-mart-1'] as const;
    queryClient.setQueryData(queryKey, [buildItem('insight-1'), buildItem('insight-2')]);
    const cancelQueries = vi.spyOn(queryClient, 'cancelQueries');
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    await removeInsightTemplateFromListCache(queryClient, 'data-mart-1', 'insight-1');

    expect(cancelQueries).toHaveBeenCalledWith({ queryKey });
    expect(queryClient.getQueryData(queryKey)).toEqual([buildItem('insight-2')]);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey });
  });
});
