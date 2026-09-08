import { AccordionItem, AccordionTrigger, AccordionContent } from '@owox/ui/components/accordion';
import { ExternalAnchor } from '@owox/ui/components/common/external-anchor';
import { useTranslation } from 'react-i18next';

export default function GoogleSheetsDescription() {
  const { t } = useTranslation();
  return (
    <AccordionItem value='sheets-api-details'>
      <AccordionTrigger>{t('destinationHelp.googleSheetsApi.title')}</AccordionTrigger>
      <AccordionContent>
        <p className='mb-2'>
          {t('destinationHelp.googleSheetsApi.introPrefix')}{' '}
          <ExternalAnchor href='https://console.cloud.google.com/apis/library/sheets.googleapis.com'>
            {t('destinationHelp.googleSheetsApi.apiLink')}
          </ExternalAnchor>{' '}
          {t('destinationHelp.googleSheetsApi.introSuffix')}
        </p>
        <p className='mb-2'>{t('destinationHelp.googleSheetsApi.stepsIntro')}</p>
        <ol className='list-inside list-decimal space-y-2 text-sm'>
          <li>{t('destinationHelp.googleSheetsApi.step1')}</li>
          <li>
            {t('destinationHelp.googleSheetsApi.step2Prefix')}{' '}
            <strong>{t('destinationHelp.googleSheetsApi.enable')}</strong>.
          </li>
          <li>{t('destinationHelp.googleSheetsApi.step3')}</li>
        </ol>
      </AccordionContent>
    </AccordionItem>
  );
}
