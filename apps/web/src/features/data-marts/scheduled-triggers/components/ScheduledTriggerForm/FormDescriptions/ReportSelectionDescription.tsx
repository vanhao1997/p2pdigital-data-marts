import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { useTranslation } from 'react-i18next';

/**
 * Accordion about selecting Report
 */
export default function ReportSelectionDescription() {
  const { t } = useTranslation();

  return (
    <Accordion variant='common' type='single' collapsible>
      <AccordionItem value='report-select-description-details'>
        <AccordionTrigger>{t('workflowHelp.reportSelection.title')}</AccordionTrigger>
        <AccordionContent>
          <p className='mb-2'>{t('workflowHelp.reportSelection.intro')}</p>
          <p>{t('workflowHelp.reportSelection.details')}</p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
