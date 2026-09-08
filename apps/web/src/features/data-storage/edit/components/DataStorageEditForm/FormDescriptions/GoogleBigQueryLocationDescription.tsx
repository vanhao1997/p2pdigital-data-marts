import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { ExternalAnchor } from '@owox/ui/components/common/external-anchor';
import { useTranslation } from 'react-i18next';

/**
 * Accordion with step-by-step instructions for GBQ Location.
 */
export default function GoogleBigQueryLocationDescription() {
  const { t } = useTranslation();

  return (
    <Accordion variant='common' type='single' collapsible>
      <AccordionItem value='gbq-location-details'>
        <AccordionTrigger>{t('storageFieldHelp.googleBigQueryLocation.title')}</AccordionTrigger>
        <AccordionContent>
          <p className='text-sm leading-6 whitespace-pre-line'>
            {t('storageFieldHelp.googleBigQueryLocation.content')}
          </p>
          <ExternalAnchor
            className='mt-2 inline-block underline'
            href='https://console.cloud.google.com/bigquery'
          >
            {t('storageFieldHelp.common.googleCloudBigQuery')}
          </ExternalAnchor>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
