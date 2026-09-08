import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { ExternalAnchor } from '@owox/ui/components/common/external-anchor';
import { useTranslation } from 'react-i18next';

export default function LegacyGoogleBigQueryTitleDescription() {
  const { t } = useTranslation();

  return (
    <Accordion variant='common' type='single' collapsible>
      <AccordionItem value='title-details'>
        <AccordionTrigger>{t('storageHelp.legacyBigQuery.titleQuestion')}</AccordionTrigger>
        <AccordionContent>
          <p className='mb-2'>{t('storageHelp.legacyBigQuery.titleFixed')}</p>
          <p className='mb-2'>
            {t('storageHelp.legacyBigQuery.separateStoragePrefix')}{' '}
            <ExternalAnchor
              className='underline'
              href='https://workspace.google.com/marketplace/app/owox_bigquery_data_marts/263000453832'
            >
              {t('storageHelp.legacyBigQuery.extension')}
            </ExternalAnchor>
            {t('storageHelp.legacyBigQuery.separateStorageSuffix')}
          </p>
          <p className='mb-2'>{t('storageHelp.legacyBigQuery.contactSupport')}</p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
