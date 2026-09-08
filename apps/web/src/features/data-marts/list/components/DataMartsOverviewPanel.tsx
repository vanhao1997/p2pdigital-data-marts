import { Button } from '@owox/ui/components/button';
import { ArrowRight, Sparkles } from 'lucide-react';
import { type ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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
    () => buildOverview(items, qualitySummaries, onViewRuns, onCreateDataMart),
    [items, qualitySummaries, onViewRuns, onCreateDataMart]
  );

  return (
    <section
      aria-label={t('dataMartsOverview.sectionLabel', 'Data Marts overview')}
      className='mb-4'
    >
      <div className='grid gap-3 lg:grid-cols-[1.2fr_1fr_1fr_1.1fr]'>
        <OverviewCard
          label={t('dataMartsOverview.dataHealth', 'Tình trạng dữ liệu')}
          value={overview.dataHealth}
          hint={t('dataMartsOverview.dataHealthHint', '{{published}}/{{total}} đã xuất bản', {
            published: String(overview.publishedCount),
            total: String(overview.totalCount),
          })}
          tone={overview.publishedCount > 0 ? 'success' : 'warning'}
        />
        <OverviewCard
          label={t('dataMartsOverview.lastUpdated', 'Lần cập nhật gần nhất')}
          value={overview.lastUpdated}
          hint={overview.lastUpdatedHint}
          tone={overview.lastUpdatedIsKnown ? 'default' : 'warning'}
        />
        <OverviewCard
          label={t('dataMartsOverview.runIssues', 'Lượt chạy lỗi/cảnh báo')}
          value={overview.runIssues}
          hint={overview.runIssuesHint}
          tone={overview.runIssueCount > 0 ? 'danger' : 'success'}
        />
        <div className='border-border bg-surface rounded-xl border p-4 shadow-sm'>
          <div className='flex items-start justify-between gap-3'>
            <div className='min-w-0'>
              <div className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
                {t('dataMartsOverview.nextAction', 'Bước tiếp theo')}
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
              <Link to={onViewRuns}>{t('dataMartsOverview.viewRuns', 'Xem lượt chạy')}</Link>
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
  onCreateDataMart = '/data-marts/create'
) {
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
      ? 'Đã quét hết nguồn'
      : 'Dữ liệu một phần hoặc đang chờ kiểm tra'
    : 'Chưa có dữ liệu cập nhật từ API';

  const runIssuesHint =
    runningCount > 0
      ? `${runningCount} lượt chạy đang xử lý`
      : `${draftCount} Data Mart bản nháp, ${publishedCount} đã xuất bản`;

  const nextActionHref = totalCount === 0 ? onCreateDataMart : onViewRuns;
  const nextActionButton = totalCount === 0 ? 'Tạo Data Mart' : 'Mở lịch sử chạy';

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
        ? 'Tạo Data Mart đầu tiên'
        : runIssueCount > 0
          ? 'Xem các lượt chạy đang có cảnh báo'
          : 'Tiếp tục theo dõi run history',
    nextActionHint:
      totalCount === 0
        ? 'Bắt đầu bằng việc tạo một Data Mart từ nguồn dữ liệu hiện có.'
        : 'Ưu tiên kiểm tra trạng thái chạy và dữ liệu mới nhất trước.',
    nextActionHref,
    nextActionButton,
  };
}
