import { AccordionItem, AccordionTrigger, AccordionContent } from '@owox/ui/components/accordion';
import { ExternalAnchor } from '@owox/ui/components/common/external-anchor';
import { useTranslation } from 'react-i18next';

export default function MicrosoftTeamsDescription() {
  const { t } = useTranslation();
  return (
    <AccordionItem value='msteams-details'>
      <AccordionTrigger>{t('destinationHelp.microsoftTeams.title')}</AccordionTrigger>
      <AccordionContent>
        <p className='mb-2'>
          {t('destinationHelp.microsoftTeams.setup')} <strong>Microsoft Teams</strong>{' '}
          {t('destinationHelp.microsoftTeams.setupAfterTeams')}{' '}
          <strong>{t('destinationHelp.common.destinations')}</strong>{' '}
          {t('destinationHelp.microsoftTeams.setupEnd')}
        </p>
        <p className='mb-2'>{t('destinationHelp.microsoftTeams.delivery')}</p>
        <p className='mb-2'>
          {t('destinationHelp.common.moreDetails')}{' '}
          <ExternalAnchor
            className='underline'
            href='https://docs.p2pdigital.io.vn/docs/destinations/supported-destinations/microsoft-teams/?utm_source=owox_data_marts&utm_medium=destination_entity&utm_campaign=tooltip-microsoft-teams'
          >
            {t('destinationHelp.common.documentation')}
          </ExternalAnchor>
          .
        </p>
      </AccordionContent>
    </AccordionItem>
  );
}
