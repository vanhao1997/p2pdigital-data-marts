import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { useTranslation } from 'react-i18next';

/**
 * Accordion with details about Google OAuth permissions requested for Google Sheets access.
 */
export default function GoogleSheetsOAuthDescription() {
  const { t } = useTranslation();
  return (
    <Accordion variant='common' type='single' collapsible>
      <AccordionItem value='oauth-details'>
        <AccordionTrigger>{t('destinationHelp.googleSheetsOAuth.title')}</AccordionTrigger>
        <AccordionContent>
          <p className='mb-2'>{t('destinationHelp.googleSheetsOAuth.intro')}</p>
          <ul className='list-inside list-disc space-y-2 text-sm'>
            <li>
              <strong>Google Sheets</strong>{' '}
              {t('destinationHelp.googleSheetsOAuth.sheetsPermission')}
            </li>
            <li>
              <strong>{t('destinationHelp.googleSheetsOAuth.profileLabel')}</strong>{' '}
              {t('destinationHelp.googleSheetsOAuth.profilePermission')}
            </li>
          </ul>
          <p className='mt-2 text-sm'>
            {t('destinationHelp.googleSheetsOAuth.revokeIntro')}{' '}
            <a
              href='https://myaccount.google.com/permissions'
              target='_blank'
              rel='noopener noreferrer'
              className='underline'
            >
              {t('destinationHelp.googleSheetsOAuth.accountSettings')}
            </a>
            .
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
