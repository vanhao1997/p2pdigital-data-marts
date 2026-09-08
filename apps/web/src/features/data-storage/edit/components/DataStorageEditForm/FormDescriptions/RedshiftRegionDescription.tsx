import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { useTranslation } from 'react-i18next';

/**
 * Accordion with information about AWS Redshift region.
 */
export default function RedshiftRegionDescription() {
  const { t } = useTranslation();

  return (
    <Accordion variant='common' type='single' collapsible>
      <AccordionItem value='redshift-region-details'>
        <AccordionTrigger>{t('storageFieldHelp.redshiftRegion.title')}</AccordionTrigger>
        <AccordionContent>
          <p className='text-sm leading-6 whitespace-pre-line'>
            {t('storageFieldHelp.redshiftRegion.content')}
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
