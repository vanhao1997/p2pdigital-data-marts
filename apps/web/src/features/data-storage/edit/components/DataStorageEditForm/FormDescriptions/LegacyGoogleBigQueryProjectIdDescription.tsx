import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { ExternalAnchor } from '@owox/ui/components/common/external-anchor';
import { useTranslation } from 'react-i18next';

export default function LegacyGoogleBigQueryProjectIdDescription() {
  const { t } = useTranslation();

  return (
    <Accordion variant='common' type='single' collapsible>
      <AccordionItem value='project-id-details'>
        <AccordionTrigger>
          {t('storageFieldHelp.legacyGoogleBigQueryProject.title')}
        </AccordionTrigger>
        <AccordionContent>
          <p className='text-sm leading-6 whitespace-pre-line'>
            {t('storageFieldHelp.legacyGoogleBigQueryProject.content')}
          </p>
          <ExternalAnchor
            className='mt-2 inline-block underline'
            href='https://workspace.google.com/marketplace/app/owox_bigquery_data_marts/263000453832'
          >
            {t('storageFieldHelp.common.p2pdigitalExtension')}
          </ExternalAnchor>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
