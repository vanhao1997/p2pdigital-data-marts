import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { ExternalAnchor } from '@owox/ui/components/common/external-anchor';
import { useTranslation } from 'react-i18next';

/**
 * Accordion with step-by-step instructions for Region.
 */
export default function AthenaRegionDescription() {
  const { t } = useTranslation();

  return (
    <Accordion variant='common' type='single' collapsible>
      <AccordionItem value='athena-region-details'>
        <AccordionTrigger>{t('storageFieldHelp.athenaRegion.title')}</AccordionTrigger>
        <AccordionContent>
          <p className='text-sm leading-6 whitespace-pre-line'>
            {t('storageFieldHelp.athenaRegion.content')}
          </p>
          <ExternalAnchor
            className='mt-2 inline-block underline'
            href='https://console.aws.amazon.com/athena/'
          >
            {t('storageFieldHelp.common.athenaConsole')}
          </ExternalAnchor>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
