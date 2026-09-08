import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { useTranslation } from 'react-i18next';

export default function GoogleChatDeliveryMethodDescription({
  deliveryMethod,
}: {
  deliveryMethod: 'webhook' | 'email';
}) {
  const { t } = useTranslation();
  const isWebhook = deliveryMethod === 'webhook';

  return (
    <Accordion variant='common' type='single' collapsible>
      <AccordionItem value='google-chat-delivery-method-details'>
        <AccordionTrigger>
          {isWebhook
            ? t('googleChat.deliveryMethodDescription.webhookTitle')
            : t('googleChat.deliveryMethodDescription.emailTitle')}
        </AccordionTrigger>
        <AccordionContent>
          <p className='text-sm'>
            {isWebhook
              ? t('googleChat.deliveryMethodDescription.webhookText')
              : t('googleChat.deliveryMethodDescription.emailText')}
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
