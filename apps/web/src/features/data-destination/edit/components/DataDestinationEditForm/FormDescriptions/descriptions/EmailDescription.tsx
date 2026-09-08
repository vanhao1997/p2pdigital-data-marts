import { AccordionItem, AccordionTrigger, AccordionContent } from '@owox/ui/components/accordion';
import { ExternalAnchor } from '@owox/ui/components/common/external-anchor';
import { useTranslation } from 'react-i18next';

export default function EmailDescription() {
  const { t } = useTranslation();
  return (
    <AccordionItem value='email-details'>
      <AccordionTrigger>{t('destinationHelp.email.title')}</AccordionTrigger>
      <AccordionContent>
        <p className='mb-2'>
          {t('destinationHelp.email.setup')} <strong>Email</strong>{' '}
          {t('destinationHelp.email.setupAfterEmail')}{' '}
          <strong>{t('destinationHelp.common.destinations')}</strong>{' '}
          {t('destinationHelp.email.setupEnd')}
        </p>
        <p className='mb-2'>{t('destinationHelp.email.delivery')}</p>
        <p className='mb-2'>
          {t('destinationHelp.common.moreDetails')}{' '}
          <ExternalAnchor
            className='underline'
            href='https://docs.p2pdigital.io.vn/docs/destinations/supported-destinations/email/?utm_source=owox_data_marts&utm_medium=destination_entity&utm_campaign=tooltip-email'
          >
            {t('destinationHelp.common.documentation')}
          </ExternalAnchor>
          .
        </p>
      </AccordionContent>
    </AccordionItem>
  );
}
