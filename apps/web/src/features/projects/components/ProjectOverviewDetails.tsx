import { Box, Plug, RefreshCw, ArrowRight, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@owox/ui/components/button';
import { DataMartStatus } from '../../data-marts/shared/enums';
import { useProjectOverview } from '../hooks/useProjectOverview';

interface Props {
  projectId: string;
  disabled: boolean;
  onOpen: (path: string) => void;
}

export function ProjectOverviewDetails({ projectId, disabled, onOpen }: Props) {
  const { t } = useTranslation();
  const { data, isPending, isError, isFetching, refetch } = useProjectOverview(projectId);
  if (isError) {
    return (
      <div className='flex items-center justify-between gap-3 border-t pt-3' role='status'>
        <p className='text-muted-foreground text-sm'>{t('projectsPage.overviewUnavailable')}</p>
        <Button
          variant='ghost'
          size='icon'
          title={t('projectsPage.refresh')}
          aria-label={t('projectsPage.refresh')}
          disabled={isFetching}
          onClick={() => {
            void refetch();
          }}
        >
          <RefreshCw className='size-4' />
        </Button>
      </div>
    );
  }
  if (isPending) {
    return (
      <p
        className='text-muted-foreground flex items-center gap-2 border-t pt-3 text-sm'
        role='status'
      >
        <Loader2 className='size-4 animate-spin' aria-hidden='true' />
        {t('projectsPage.loading')}
      </p>
    );
  }
  const remaining = data.dataMartsCount - data.dataMarts.length;
  return (
    <div className='space-y-3 border-t pt-3'>
      <dl className='grid grid-cols-3 gap-3'>
        {[
          { label: t('projectsPage.dataMarts'), count: data.dataMartsCount, icon: Box },
          { label: t('projectsPage.connectors'), count: data.connectors.length, icon: Plug },
          { label: t('projectsPage.runningSyncs'), count: data.runningSyncsCount, icon: RefreshCw },
        ].map(({ label, count, icon: Icon }) => (
          <div key={label} className='min-w-0'>
            <dt className='text-muted-foreground flex items-center gap-1.5 text-xs'>
              <Icon className='size-3.5 shrink-0' aria-hidden='true' />
              {label}
            </dt>
            <dd
              className={`mt-1 text-xl font-semibold tabular-nums ${label === t('projectsPage.runningSyncs') && count > 0 ? 'text-emerald-600 dark:text-emerald-400' : ''}`}
            >
              {count}
            </dd>
          </div>
        ))}
      </dl>
      <div className='text-sm'>
        <h3 className='text-muted-foreground mb-1 text-xs'>{t('projectsPage.dataMarts')}</h3>
        {data.dataMarts.length ? (
          <ul className='space-y-1'>
            {data.dataMarts.map(mart => (
              <li key={mart.id} className='flex min-w-0 items-center gap-2'>
                <button
                  type='button'
                  className='hover:text-primary flex min-w-0 flex-1 items-center gap-1 text-left hover:underline disabled:opacity-50'
                  disabled={disabled}
                  onClick={() => {
                    onOpen(`/data-marts/${mart.id}/overview`);
                  }}
                >
                  <span className='truncate' title={mart.title}>
                    {mart.title}
                  </span>
                  <ArrowRight className='size-3.5 shrink-0' aria-hidden='true' />
                </button>
                <span className='text-muted-foreground shrink-0 text-xs'>
                  {t(
                    mart.status === DataMartStatus.DRAFT
                      ? 'projectsPage.draft'
                      : 'projectsPage.published'
                  )}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className='text-muted-foreground'>{t('projectsPage.noDataMarts')}</p>
        )}
        {remaining > 0 && (
          <button
            type='button'
            className='text-primary mt-1 text-xs hover:underline disabled:opacity-50'
            disabled={disabled}
            onClick={() => {
              onOpen('/data-marts');
            }}
          >
            {t('projectsPage.moreDataMarts', { count: remaining })}
          </button>
        )}
      </div>
      <div className='text-sm'>
        <h3 className='text-muted-foreground mb-1 text-xs'>{t('projectsPage.connectors')}</h3>
        {data.connectors.length ? (
          <ul className='flex flex-wrap gap-x-4 gap-y-1'>
            {data.connectors.map(connector => (
              <li key={connector.name} className='min-w-0 break-words'>
                {connector.name}{' '}
                <span className='text-muted-foreground tabular-nums'>
                  ({connector.dataMartsCount})
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className='text-muted-foreground'>{t('projectsPage.noConnectors')}</p>
        )}
      </div>
    </div>
  );
}
