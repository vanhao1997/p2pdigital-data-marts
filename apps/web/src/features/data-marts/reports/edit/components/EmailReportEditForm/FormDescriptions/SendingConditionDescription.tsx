import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { useTranslation } from 'react-i18next';

export default function SendingConditionDescription() {
  const { t } = useTranslation();

  return (
    <Accordion variant='common' type='single' collapsible>
      <AccordionItem value='sending-condition-details'>
        <AccordionTrigger>{t('reportsUi.sendingConditionHelpTitle')}</AccordionTrigger>
        <AccordionContent>
          <p className='mb-2'>{t('reportsUi.sendingConditionHelpIntro')}</p>
          <p>{t('reportsUi.sendingConditionHelpBehavior')}</p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
