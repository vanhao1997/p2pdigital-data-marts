import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { useTranslation } from 'react-i18next';

/**
 * Accordion about trigger type options
 */
export default function TriggerTypeOptionsDescription() {
  const { t } = useTranslation();

  return (
    <Accordion variant='common' type='single' collapsible>
      <AccordionItem value='trigger-type-options-description-details'>
        <AccordionTrigger>{t('workflowHelp.triggerType.title')}</AccordionTrigger>
        <AccordionContent>
          <p className='mb-2'>{t('workflowHelp.triggerType.reportRun')}</p>
          <p className='mb-2'>{t('workflowHelp.triggerType.connectorRun')}</p>
          <p className='mb-2'>{t('workflowHelp.triggerType.dataQualityRun')}</p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
