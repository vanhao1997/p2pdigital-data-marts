import {
  CollapsibleCard,
  CollapsibleCardHeader,
  CollapsibleCardHeaderTitle,
  CollapsibleCardContent,
  CollapsibleCardFooter,
  CollapsibleCardHeaderActions,
} from '../../shared/components/CollapsibleCard/index.ts';
import { Info, BookOpen, Airplay } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '../../shared/components/Button/index.tsx';
import { useContentPopovers } from '../../app/store/hooks/useContentPopovers.ts';
import { useTranslation } from 'react-i18next';

export function PageNotificationLegacyStorageSetup() {
  const { t } = useTranslation();
  const { open } = useContentPopovers();
  return (
    <div className='mb-4'>
      <CollapsibleCard collapsible name='notification-legacy-storage-setup'>
        <CollapsibleCardHeader>
          <CollapsibleCardHeaderTitle icon={Info}>
            {t('legacyStorageNotice.title')}
          </CollapsibleCardHeaderTitle>
          <CollapsibleCardHeaderActions>
            <p className='text-muted-foreground/75 text-sm'>
              {t('legacyStorageNotice.actionRequired')}
            </p>
          </CollapsibleCardHeaderActions>
        </CollapsibleCardHeader>
        <CollapsibleCardContent>
          <div className='rounded-md border-b border-gray-200 bg-white dark:border-white/4 dark:bg-white/1'>
            <div className='flex flex-col gap-4 p-4 text-sm xl:p-6'>
              <div className='flex flex-col gap-2'>
                <p>
                  {t('legacyStorageNotice.createdWith')}{' '}
                  <a
                    href='https://workspace.google.com/marketplace/app/owox_bigquery_data_marts/263000453832'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='text-foreground font-semibold underline'
                  >
                    P2PDigital Reports
                  </a>{' '}
                  {t('legacyStorageNotice.extensionSuffix')}{' '}
                  <span className='font-semibold'>{t('common.draft')}</span>{' '}
                  {t('legacyStorageNotice.statusSuffix')}
                </p>
                <p>{t('legacyStorageNotice.instructions')}</p>
                <ol className='ml-4 flex list-inside list-decimal flex-col gap-1 text-left'>
                  <li>
                    <span className='font-semibold'>{t('common.select')}</span>{' '}
                    {t('legacyStorageNotice.storage')}
                  </li>
                  <li>
                    <span className='font-semibold'>{t('legacyStorageNotice.grantAccess')}</span>{' '}
                    {t('legacyStorageNotice.bigQuerySuffix')}
                  </li>
                  <li>
                    <span className='font-semibold'>{t('common.publish')}</span>{' '}
                    {t('legacyStorageNotice.publishSuffix')}
                  </li>
                </ol>
              </div>
              <div className='flex items-center gap-2'>
                <Button
                  onClick={() => {
                    open('video-4-legacy-storage-setup');
                  }}
                >
                  <Airplay className='size-4' /> {t('legacyStorageNotice.watchVideo')}
                </Button>
                <Button variant='outline' asChild>
                  <Link
                    to='https://docs.p2pdigital.io.vn/docs/getting-started/setup-guide/extension-data-marts/?utm_source=owox-data-marts&utm_medium=ui&utm_campaign=legacy-storage-info-block'
                    target='_blank'
                    rel='noopener noreferrer'
                  >
                    <BookOpen className='size-4' />
                    {t('legacyStorageNotice.viewGuide')}
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </CollapsibleCardContent>
        <CollapsibleCardFooter />
      </CollapsibleCard>
    </div>
  );
}
