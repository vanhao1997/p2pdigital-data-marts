import { InsightColumnKey } from './columnKeys';

export const getInsightColumnLabels = (
  t: (key: string, defaultValue: string) => string
): Record<InsightColumnKey, string> => ({
  [InsightColumnKey.TITLE]: t('common.title', 'Title'),
  [InsightColumnKey.LAST_RUN]: t('insightsUi.lastRunColumn', 'Last Run'),
});
