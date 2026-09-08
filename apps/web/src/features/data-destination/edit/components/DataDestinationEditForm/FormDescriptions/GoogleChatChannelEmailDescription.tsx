import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { ExternalAnchor } from '@owox/ui/components/common/external-anchor';
import { useTranslation } from 'react-i18next';

export default function GoogleChatChannelEmailDescription() {
  const { t } = useTranslation();
  return (
    <Accordion variant='common' type='single' collapsible>
      <AccordionItem value='google-chat-channel-email-details'>
        <AccordionTrigger>{t('googleChat.channelEmailDescription.title')}</AccordionTrigger>
        <AccordionContent>
          <ol className='list-inside list-decimal space-y-2 text-sm'>
            <li>{t('googleChat.channelEmailDescription.openSpace')}</li>
            <li>{t('googleChat.channelEmailDescription.spaceSettings')}</li>
            <li>{t('googleChat.channelEmailDescription.generateEmail')}</li>
            <li>{t('googleChat.channelEmailDescription.copyAddress')}</li>
          </ol>
          <p className='mt-2 text-sm'>{t('googleChat.channelEmailDescription.managersOnly')}</p>
          <p className='mt-2 text-sm'>
            {t('googleChat.channelEmailDescription.seeGuide')}{' '}
            <ExternalAnchor href='https://support.google.com/chat/answer/14929313'>
              {t('googleChat.channelEmailDescription.guide')}
            </ExternalAnchor>{' '}
            {t('googleChat.channelEmailDescription.forDetails')}
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
