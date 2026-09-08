import { AccordionItem, AccordionTrigger, AccordionContent } from '@owox/ui/components/accordion';
import { ExternalAnchor } from '@owox/ui/components/common/external-anchor';
import { useTranslation } from 'react-i18next';

export default function GoogleChatDescription() {
  const { t } = useTranslation();
  return (
    <AccordionItem value='googlechat-details'>
      <AccordionTrigger>{t('destinationHelp.googleChat.title')}</AccordionTrigger>
      <AccordionContent>
        <p className='mb-2'>
          {t('destinationHelp.googleChat.choose')}{' '}
          <strong>{t('googleChat.incomingWebhook')}</strong>{' '}
          {t('destinationHelp.googleChat.webhookText')}{' '}
          <strong>{t('googleChat.channelEmail')}</strong>{' '}
          {t('destinationHelp.googleChat.emailText')} <strong>Apps &amp; integrations</strong>{' '}
          {t('destinationHelp.googleChat.appsText')}
        </p>
        <p className='mb-2'>
          {t('destinationHelp.googleChat.reportSetup')}{' '}
          <strong>{t('destinationHelp.common.destinations')}</strong>{' '}
          {t('destinationHelp.googleChat.reportSetupEnd')}
        </p>
        <p className='mb-2'>
          {t('destinationHelp.common.moreDetails')}{' '}
          <ExternalAnchor
            className='underline'
            href='https://docs.p2pdigital.io.vn/docs/destinations/supported-destinations/google-chat/?utm_source=owox_data_marts&utm_medium=destination_entity&utm_campaign=tooltip-google-chat'
          >
            {t('destinationHelp.common.documentation')}
          </ExternalAnchor>
          .
        </p>
      </AccordionContent>
    </AccordionItem>
  );
}
