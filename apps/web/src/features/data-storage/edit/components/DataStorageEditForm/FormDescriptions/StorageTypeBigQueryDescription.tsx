import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { ExternalAnchor } from '@owox/ui/components/common/external-anchor';
import { useTranslation } from 'react-i18next';

/**
 * Accordion with step-by-step instructions for enabling the Google BigQuery API.
 */
export default function StorageTypeBigQueryDescription() {
  const { t } = useTranslation();

  return (
    <Accordion variant='common' type='single' collapsible>
      <AccordionItem value='bigquery-api-details'>
        <AccordionTrigger>{t('storageHelp.bigQuery.title')}</AccordionTrigger>
        <AccordionContent>
          <p className='mb-2'>
            {t('storageHelp.bigQuery.intro')}{' '}
            <ExternalAnchor
              className='underline'
              href='https://console.cloud.google.com/apis/library/bigquery.googleapis.com'
            >
              {t('storageHelp.bigQuery.apiLink')}
            </ExternalAnchor>{' '}
            {t('storageHelp.bigQuery.projectSuffix')}
          </p>
          <p className='mb-2'>{t('storageHelp.bigQuery.stepsIntro')}</p>
          <ol className='list-inside list-decimal space-y-2 text-sm'>
            <li>{t('storageHelp.bigQuery.openLink')}</li>
            <li>
              {t('storageHelp.bigQuery.enablePrefix')}{' '}
              <strong>{t('storageHelp.bigQuery.enable')}</strong>.
            </li>
            <li>{t('storageHelp.bigQuery.alreadyEnabled')}</li>
          </ol>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
