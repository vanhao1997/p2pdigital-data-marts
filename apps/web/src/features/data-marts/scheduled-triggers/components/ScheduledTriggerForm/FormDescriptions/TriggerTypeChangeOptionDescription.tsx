import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { useTranslation } from 'react-i18next';

/**
 * Accordion about trigger type changing
 */
export default function TriggerTypeChangeOptionDescription() {
  const { t } = useTranslation();

  return (
    <Accordion variant='common' type='single' collapsible>
      <AccordionItem value='trigger-type-change-description-details'>
        <AccordionTrigger>{t('workflowHelp.triggerTypeChange.title')}</AccordionTrigger>
        <AccordionContent>
          <p>{t('workflowHelp.triggerTypeChange.body')}</p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
