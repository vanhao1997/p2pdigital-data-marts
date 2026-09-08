import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { useTranslation } from 'react-i18next';

/**
 * Accordion with details about Google OAuth permissions requested for BigQuery access.
 */
export default function GoogleBigQueryOAuthDescription() {
  const { t } = useTranslation();

  return (
    <Accordion variant='common' type='single' collapsible>
      <AccordionItem value='oauth-details'>
        <AccordionTrigger>{t('storageFieldHelp.googleBigQueryOAuth.title')}</AccordionTrigger>
        <AccordionContent>
          <p className='text-sm leading-6 whitespace-pre-line'>
            {t('storageFieldHelp.googleBigQueryOAuth.content')}
          </p>
          <p className='mt-2 text-sm'>
            <a
              href='https://myaccount.google.com/permissions'
              target='_blank'
              rel='noopener noreferrer'
              className='underline'
            >
              {t('storageFieldHelp.common.googleAccountSettings')}
            </a>
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
