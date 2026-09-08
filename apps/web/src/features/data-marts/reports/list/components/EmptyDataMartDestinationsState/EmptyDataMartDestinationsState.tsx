import { Link } from 'react-router';
import { useProjectRoute } from '../../../../../../shared/hooks';
import { PromoBlock } from '../../../../../../shared/components/PromoBlock/PromoBlock';
import { GoogleSheetsIcon } from '../../../../../../shared/icons/google-sheets-icon';
import { Button } from '@owox/ui/components/button';
import { ArchiveRestore, ChevronRight } from 'lucide-react';
import { InviteTeammatesCard } from '../../../../../../shared/components/InviteTeammatesCard';
import { useTranslation } from 'react-i18next';

interface Props {
  variant?: 'default' | 'promo';
  onOpenCreateDestination?: () => void;
}

export function EmptyDataMartDestinationsState({
  variant = 'default',
  onOpenCreateDestination,
}: Props) {
  const { t } = useTranslation();
  const { scope } = useProjectRoute();
  // Promo variant (show after data mart is published)
  if (variant === 'promo') {
    return (
      <div className='flex flex-col gap-0.5'>
        <PromoBlock
          icon={GoogleSheetsIcon}
          title={t('reportsEmptyDestinations.analyzeTitle', 'Analyze your data in Google Sheets')}
          subtitle={t('reportsEmptyDestinations.ready', 'Ready to start reporting?')}
          description={t(
            'reportsEmptyDestinations.description',
            'Access live data directly in Sheets — choose columns and build reports without SQL or CSV exports.'
          )}
          primaryAction={{
            label: t('reportsEmptyDestinations.connectSheets', 'Connect Google Sheets'),
            ...(onOpenCreateDestination
              ? {
                  onClick: onOpenCreateDestination,
                }
              : {
                  href: scope('/data-destinations'),
                }),
          }}
          secondaryAction={{
            label: t('reportsEmptyDestinations.viewDestinations', 'View all destinations'),
            href: scope('/data-destinations'),
          }}
        />
        <InviteTeammatesCard
          hint={t('destinationsPage.inviteHint')}
          docsLabel={t(
            'reportsEmptyDestinations.learnMore',
            'Learn more about Google Sheets destination'
          )}
          docsHref='https://docs.p2pdigital.io.vn/docs/destinations/supported-destinations/google-sheets/?utm_source=owox_data_marts&utm_medium=dm_page_destinations_tab&utm_campaign=empty_state'
        />
      </div>
    );
  }

  // Default empty state (show before data mart is published)
  return (
    <div className='flex flex-col gap-0.5'>
      <div className='dm-card'>
        <div className='dm-empty-state'>
          <ArchiveRestore className='dm-empty-state-ico' strokeWidth={1} />

          <h2 className='dm-empty-state-title'>
            {t(
              'reportsEmptyDestinations.headline',
              'Google Sheets, Data Studio, Email… and friends!'
            )}
          </h2>

          <p className='dm-empty-state-subtitle'>
            {t(
              'reportsEmptyDestinations.createDestination',
              'To turn data into reports using your favorite tools, create a Destination first.'
            )}
          </p>

          <Button variant='outline' asChild>
            <Link to={scope('/data-destinations')} className='flex items-center gap-1'>
              {t('reportsEmptyDestinations.goDestinations', 'Go to Destinations')}
              <ChevronRight className='h-4 w-4' />
            </Link>
          </Button>
        </div>
      </div>
      <InviteTeammatesCard
        hint={t('destinationsPage.inviteHint')}
        docsLabel={t(
          'reportsEmptyDestinations.learnMore',
          'Learn more about Google Sheets destination'
        )}
        docsHref='https://docs.p2pdigital.io.vn/docs/destinations/supported-destinations/google-sheets/?utm_source=owox_data_marts&utm_medium=dm_page_destinations_tab&utm_campaign=empty_state'
      />
    </div>
  );
}
