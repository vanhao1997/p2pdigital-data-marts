import { AccordionItem, AccordionTrigger, AccordionContent } from '@owox/ui/components/accordion';
import { ExternalAnchor } from '@owox/ui/components/common/external-anchor';
import { useTranslation } from 'react-i18next';

export default function LookerStudioDescription() {
  const { t } = useTranslation();
  return (
    <AccordionItem value='looker-studio-details'>
      <AccordionTrigger>{t('destinationHelp.lookerStudio.title')}</AccordionTrigger>
      <AccordionContent>
        <p className='mb-2'>
          {t('destinationHelp.lookerStudio.setup')}{' '}
          <ExternalAnchor
            className='p-0'
            href='https://datastudio.google.com/datasources/create?connectorId=AKfycbz6kcYn3qGuG0jVNFjcDnkXvVDiz4hewKdAFjOm-_d4VkKVcBidPjqZO991AvGL3FtM4A'
          >
            {t('destinationHelp.lookerStudio.connector')}
          </ExternalAnchor>{' '}
          {t('destinationHelp.lookerStudio.setupEnd')}
        </p>
        <p className='mb-2'>{t('destinationHelp.lookerStudio.security')}</p>
        <ExternalAnchor
          className='p-0'
          href='https://docs.p2pdigital.io.vn/docs/destinations/supported-destinations/data-studio/?utm_source=owox_data_marts&utm_medium=destination_entity&utm_campaign=tooltip'
        >
          {t('destinationHelp.common.learnMore')}
        </ExternalAnchor>
      </AccordionContent>
    </AccordionItem>
  );
}
