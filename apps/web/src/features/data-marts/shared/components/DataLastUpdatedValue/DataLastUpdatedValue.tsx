import { Tooltip, TooltipContent, TooltipTrigger } from '@owox/ui/components/tooltip';
import type { DataLastUpdatedDto } from '../../types/api/response/data-mart-data-last-updated.dto';
import {
  describeCoverage,
  formatAbsoluteTime,
  formatDataLastUpdatedLabel,
  formatRelativeTime,
} from '../../utils/data-last-updated.utils';
import { useTranslation } from 'react-i18next';

/**
 * Tooltip body for a Data Last Updated snapshot: exact timestamp, when the check ran, coverage,
 * per-table detail, and the "write time ≠ data period" caveat. Shared by every trigger shape —
 * the text value in lists and tiles, and the icon on the canvas — so all surfaces tell the same
 * story.
 */
export function DataLastUpdatedDetails({ block }: { block: DataLastUpdatedDto }) {
  const { t } = useTranslation();
  return (
    <div className='flex flex-col gap-1 text-xs'>
      <div>
        {block.dataLastUpdatedAt
          ? t('dataLastUpdated.sourceTablesChanged', 'Source tables last changed: {{date}}', {
              date: formatAbsoluteTime(block.dataLastUpdatedAt),
            })
          : t(
              'dataLastUpdated.noModificationTime',
              'The storage did not report a modification time.'
            )}
      </div>
      <div>
        {t('dataLastUpdated.checked', 'Checked {{time}}', {
          time: formatRelativeTime(block.computedAt),
        })}
      </div>
      <div>{describeCoverage(block.coverage)}</div>
      {block.sources && block.sources.length > 0 && (
        <ul className='mt-1 flex flex-col gap-0.5'>
          {block.sources.map(source => (
            <li key={source.table} className='truncate'>
              <span className='font-mono'>{source.table}</span>
              {' — '}
              {source.dataLastUpdatedAt
                ? formatAbsoluteTime(source.dataLastUpdatedAt)
                : (source.note ?? t('common.unknown', 'Unknown'))}
            </li>
          ))}
        </ul>
      )}
      <div className='text-muted-foreground'>
        {t(
          'dataLastUpdated.writeTimeCaveat',
          'Reflects when source tables were written to, not which period the data covers.'
        )}
      </div>
    </div>
  );
}

interface DataLastUpdatedValueProps {
  block: DataLastUpdatedDto | null | undefined;
  /** Compact renders bare text (list cells); default adds the muted styling. */
  compact?: boolean;
  className?: string;
}

/**
 * The one place that turns a Data Last Updated snapshot into UI, so every surface tells the
 * same story: a storage-level write time (never "freshness"), "Unknown" for null (never
 * "stale"), and a "≥" floor for partial coverage.
 */
export function DataLastUpdatedValue({ block, compact, className }: DataLastUpdatedValueProps) {
  const { t } = useTranslation();
  const label = formatDataLastUpdatedLabel(block);

  if (!block) {
    return (
      <span
        className={className ?? 'text-muted-foreground text-sm'}
        title={t('dataLastUpdated.notCheckedYet', 'Not checked yet')}
      >
        {label}
      </span>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={className ?? (compact ? undefined : 'text-muted-foreground text-sm')}
          data-testid='dataLastUpdatedValue'
        >
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent side='top' align='start' role='tooltip' className='max-w-xs'>
        <DataLastUpdatedDetails block={block} />
      </TooltipContent>
    </Tooltip>
  );
}
