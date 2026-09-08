import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { ExternalAnchor } from '@owox/ui/components/common/external-anchor';
import { useTranslation } from 'react-i18next';

/**
 * Accordion with step-by-step instructions for OutputBucket.
 */
export default function AthenaOutputBucketDescription() {
  const { t } = useTranslation();

  return (
    <Accordion variant='common' type='single' collapsible>
      <AccordionItem value='athena-output-bucket-details'>
        <AccordionTrigger>{t('storageFieldHelp.athenaBucket.title')}</AccordionTrigger>
        <AccordionContent>
          <p className='text-sm leading-6 whitespace-pre-line'>
            {t('storageFieldHelp.athenaBucket.content')}
          </p>
          <ExternalAnchor
            className='mt-2 inline-block underline'
            href='https://console.aws.amazon.com/s3/'
          >
            {t('storageFieldHelp.common.s3Console')}
          </ExternalAnchor>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
