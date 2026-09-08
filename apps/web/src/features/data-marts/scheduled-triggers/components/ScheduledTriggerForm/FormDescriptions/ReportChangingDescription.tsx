import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { useTranslation } from 'react-i18next';

/**
 * Accordion about changing Report
 */
export default function ReportChangingDescription() {
  const { t } = useTranslation();

  return (
    <Accordion variant='common' type='single' collapsible>
      <AccordionItem value='report-change-description-details'>
        <AccordionTrigger>{t('workflowHelp.reportChanging.title')}</AccordionTrigger>
        <AccordionContent>
          <p>{t('workflowHelp.reportChanging.body')}</p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
