import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { ExternalAnchor } from '@owox/ui/components/common/external-anchor';
import { useTranslation } from 'react-i18next';

/**
 * Accordion with step-by-step instructions for obtaining a Google Service Account JSON key.
 */
export default function GoogleBigQueryProjectIdDescription() {
  const { t } = useTranslation();

  return (
    <Accordion variant='common' type='single' collapsible>
      <AccordionItem value='project-id-details'>
        <AccordionTrigger>{t('storageFieldHelp.googleBigQueryProject.title')}</AccordionTrigger>
        <AccordionContent>
          <p className='text-sm leading-6 whitespace-pre-line'>
            {t('storageFieldHelp.googleBigQueryProject.content')}
          </p>
          <ExternalAnchor
            className='mt-2 inline-block underline'
            href='https://console.cloud.google.com/'
          >
            {t('storageFieldHelp.common.googleCloudConsole')}
          </ExternalAnchor>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
