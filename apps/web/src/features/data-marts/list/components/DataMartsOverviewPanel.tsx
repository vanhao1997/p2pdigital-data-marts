import { Button } from '@owox/ui/components/button';
import { ArrowRight, Sparkles } from 'lucide-react';
import { type ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Link } from 'react-router';
import { DataLastUpdatedValue } from '../../shared/components/DataLastUpdatedValue';
import type { DataMartListItem } from '../model/types';
import type { DataQualityCompactSummary } from '../../shared/types';
import { DataMartStatus } from '../../shared/enums/data-mart-status.enum';

interface DataMartsOverviewPanelProps {
  items: DataMartListItem[];
  qualitySummaries?: Partial<Record<string, DataQualityCompactSummary>>;
  onViewRuns: string;
  onCreateDataMart?: string;
}

interface OverviewCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: 'default' | 'success' | 'warning' | 'danger';
}

export function DataMartsOverviewPanel({
  items,
  qualitySummaries,
  onViewRuns,
  onCreateDataMart = '/data-marts/create',
}: DataMartsOverviewPanelProps) {
  const { t } = useTranslation();
  const overview = useMemo(
    () => buildOverview(items, qualitySummaries, onViewRuns, onCreateDataMart, t),
    [items, qualitySummaries, onViewRuns, onCreateDataMart, t]
  );

  return (
    <section
      aria-label={t('dataMartsOverview.sectionLabel', 'Data Marts overview')}
      className='mb-4'
    >
      <div className='grid gap-3 lg:grid-cols-[1.2fr_1fr_1fr_1.1fr]'>
        <OverviewCard
          label={t('dataMartsOverview.dataHealth', 'Data health')}
          value={overview.dataHealth}
          hint={t('dataMartsOverview.dataHealthHint', '{{published}}/{{total}} published', {
            published: String(overview.publishedCount),
            total: String(overview.totalCount),
          })}
          tone={overview.publishedCount > 0 ? 'success' : 'warning'}
        />
        <OverviewCard
          label={t('dataMartsOverview.lastUpdated', 'Last updated')}
          value={overview.lastUpdated}
          hint={overview.lastUpdatedHint}
          tone={overview.lastUpdatedIsKnown ? 'default' : 'warning'}
        />
        <OverviewCard
          label={t('dataMartsOverview.runIssues', 'Run issues')}
          value={overview.runIssues}
          hint={overview.runIssuesHint}
          tone={overview.runIssueCount > 0 ? 'danger' : 'success'}
        />
        <div className='border-border bg-surface rounded-xl border p-4 shadow-sm'>
          <div className='flex items-start justify-between gap-3'>
            <div className='min-w-0'>
              <div className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
                {t('dataMartsOverview.nextAction', 'Next action')}
              </div>
              <div className='text-foreground mt-2 text-sm font-medium'>{overview.nextAction}</div>
              <p className='text-muted-foreground mt-1 text-sm'>{overview.nextActionHint}</p>
            </div>
            <Sparkles className='text-primary mt-1 size-4 shrink-0' aria-hidden='true' />
          </div>
          <div className='mt-4 flex flex-wrap gap-2'>
            <Button asChild size='sm'>
              <Link to={overview.nextActionHref}>
                {overview.nextActionButton}
                <ArrowRight className='size-4' />
              </Link>
            </Button>
            <Button asChild variant='outline' size='sm'>
              <Link to={onViewRuns}>{t('dataMartsOverview.viewRuns', 'View runs')}</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function OverviewCard({ label, value, hint, tone = 'default' }: OverviewCardProps) {
  const toneClass =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/20'
      : tone === 'warning'
        ? 'border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/20'
        : tone === 'danger'
          ? 'border-rose-200 bg-rose-50/70 dark:border-rose-900/60 dark:bg-rose-950/20'
          : 'border-border bg-surface';

  return (
    <div className={`rounded-xl border p-4 shadow-sm ${toneClass}`}>
      <div className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
        {label}
      </div>
      <div className='text-foreground mt-2 text-2xl leading-tight font-semibold'>{value}</div>
      {hint ? <div className='text-muted-foreground mt-2 text-sm'>{hint}</div> : null}
    </div>
  );
}

function buildOverview(
  items: DataMartListItem[],
  qualitySummaries?: Partial<Record<string, DataQualityCompactSummary>>,
  onViewRuns = '/data-marts/runs',
  onCreateDataMart = '/data-marts/create',
  t?: TFunction
) {
  const translate =
    t ??
    ((_key: string, fallback: string, options?: Record<string, unknown>) => {
      let value = fallback;
      for (const [name, replacement] of Object.entries(options ?? {})) {
        value = value.replace(`{{${name}}}`, String(replacement));
      }
      return value;
    });
  const totalCount = items.length;
  const publishedCount = items.filter(
    item => (item.status as { code?: string } | undefined)?.code === DataMartStatus.PUBLISHED
  ).length;
  const draftCount = totalCount - publishedCount;
  const dataLastUpdatedValues = [...items]
    .map(item => item.dataLastUpdated)
    .filter((value): value is NonNullable<DataMartListItem['dataLastUpdated']> => Boolean(value))
    .sort((left, right) => {
      const leftValue = left.dataLastUpdatedAt ?? left.computedAt;
      const rightValue = right.dataLastUpdatedAt ?? right.computedAt;
      return rightValue.localeCompare(leftValue);
    });
  const hasLastUpdated = dataLastUpdatedValues.length > 0;
  const latestDataLastUpdated = dataLastUpdatedValues[0];

  const summaries = Object.values(qualitySummaries ?? {});
  const runIssueCount = summaries.filter(summary =>
    ['ISSUES', 'EXECUTION_FAILED', 'RESTRICTED'].includes(
      (summary as { state?: string } | undefined)?.state ?? ''
    )
  ).length;
  const runningCount = summaries.filter(summary =>
    ['QUEUED', 'RUNNING'].includes((summary as { state?: string } | undefined)?.state ?? '')
  ).length;

  const lastUpdated = hasLastUpdated ? (
    <DataLastUpdatedValue block={latestDataLastUpdated} compact />
  ) : (
    '—'
  );

  const lastUpdatedHint = hasLastUpdated
    ? latestDataLastUpdated.coverage === 'complete'
      ? translate('dataMartsOverview.lastUpdatedComplete', 'All sources scanned')
      : translate('dataMartsOverview.lastUpdatedPartial', 'Partial data or pending verification')
    : translate('dataMartsOverview.lastUpdatedUnavailable', 'No API freshness data yet');

  const runIssuesHint =
    runningCount > 0
      ? translate('dataMartsOverview.runningRuns', '{{count}} run in progress', {
          count: runningCount,
        })
      : translate(
          'dataMartsOverview.draftPublishedHint',
          '{{draft}} draft Data Mart, {{published}} published',
          {
            draft: draftCount,
            published: publishedCount,
          }
        );

  const nextActionHref = totalCount === 0 ? onCreateDataMart : onViewRuns;
  const nextActionButton =
    totalCount === 0
      ? translate('dataMartsOverview.createDataMartAction', 'Create Data Mart')
      : translate('dataMartsOverview.openRunHistory', 'Open run history');

  return {
    totalCount,
    publishedCount,
    draftCount,
    dataHealth: totalCount ? `${publishedCount}/${totalCount}` : '0',
    lastUpdated,
    lastUpdatedHint,
    lastUpdatedIsKnown: hasLastUpdated,
    runIssues: runIssueCount ? `${runIssueCount}` : '0',
    runIssuesHint,
    runIssueCount,
    nextAction:
      totalCount === 0
        ? translate('dataMartsOverview.createFirstDataMart', 'Create the first Data Mart')
        : runIssueCount > 0
          ? translate('dataMartsOverview.reviewRunWarnings', 'Review runs with warnings')
          : translate('dataMartsOverview.monitorRunHistory', 'Keep monitoring run history'),
    nextActionHint:
      totalCount === 0
        ? translate(
            'dataMartsOverview.createFirstHint',
            'Start by creating a Data Mart from an existing data source.'
          )
        : translate(
            'dataMartsOverview.reviewRunHistoryHint',
            'Check run status and the latest data freshness first.'
          ),
    nextActionHref,
    nextActionButton,
  };
}
