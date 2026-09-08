import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { useTranslation } from 'react-i18next';

/**
 * Accordion with a brief explanation of the available Google Sheets authentication methods.
 */
export default function GoogleSheetsAuthMethodDescription() {
  const { t } = useTranslation();
  return (
    <Accordion variant='common' type='single' collapsible>
      <AccordionItem value='google-sheets-auth-method-details'>
        <AccordionTrigger>{t('destinationHelp.googleSheetsAuth.title')}</AccordionTrigger>
        <AccordionContent>
          <p className='mb-2'>{t('destinationHelp.googleSheetsAuth.intro')}</p>
          <div className='space-y-3 text-sm'>
            <div>
              <strong className='font-medium'>
                {t('destinationHelp.googleSheetsAuth.oauthLabel')}
              </strong>
              <p className='mt-1'>{t('destinationHelp.googleSheetsAuth.oauthText')}</p>
            </div>
            <div>
              <strong className='font-medium'>
                {t('destinationHelp.googleSheetsAuth.serviceAccountLabel')}
              </strong>
              <p className='mt-1'>{t('destinationHelp.googleSheetsAuth.serviceAccountText')}</p>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
