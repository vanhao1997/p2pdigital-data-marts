import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { ExternalAnchor } from '@owox/ui/components/common/external-anchor';
import { useTranslation } from 'react-i18next';

export default function GoogleChatWebhookDescription() {
  const { t } = useTranslation();
  return (
    <Accordion variant='common' type='single' collapsible>
      <AccordionItem value='google-chat-webhook-details'>
        <AccordionTrigger>{t('googleChat.webhookDescription.title')}</AccordionTrigger>
        <AccordionContent>
          <ol className='list-inside list-decimal space-y-2 text-sm'>
            <li>{t('googleChat.webhookDescription.openSpace')}</li>
            <li>{t('googleChat.webhookDescription.appsIntegrations')}</li>
            <li>{t('googleChat.webhookDescription.addWebhooks')}</li>
            <li>{t('googleChat.webhookDescription.copyLink')}</li>
          </ol>
          <p className='mt-2 text-sm'>{t('googleChat.webhookDescription.warning')}</p>
          <p className='mt-2 text-sm'>
            {t('googleChat.webhookDescription.seeGuide')}{' '}
            <ExternalAnchor href='https://developers.google.com/workspace/chat/quickstart/webhooks'>
              {t('googleChat.webhookDescription.guide')}
            </ExternalAnchor>{' '}
            {t('googleChat.webhookDescription.forDetails')}
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
