import type { QueryClient } from '@tanstack/react-query';
import type { InsightTemplateEntity } from './types/insight-template.entity';
import { INSIGHT_TEMPLATES_QUERY_KEY } from './hooks/useInsightTemplates';

export async function removeInsightTemplateFromListCache(
  queryClient: QueryClient,
  dataMartId: string,
  insightId: string
) {
  const queryKey = [INSIGHT_TEMPLATES_QUERY_KEY, dataMartId] as const;

  await queryClient.cancelQueries({ queryKey });
  queryClient.setQueryData<InsightTemplateEntity[]>(queryKey, previous =>
    previous?.filter(item => item.id !== insightId)
  );
  await queryClient.invalidateQueries({ queryKey });
}
