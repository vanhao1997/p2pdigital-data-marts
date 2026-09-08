import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { useTranslation } from 'react-i18next';

export default function LookerStudioCacheLifetimeDescription() {
  const { t } = useTranslation();

  return (
    <Accordion variant='common' type='single' collapsible>
      <AccordionItem value='cache-lifetime-details'>
        <AccordionTrigger>{t('reportsUi.cacheHelpTitle')}</AccordionTrigger>
        <AccordionContent>
          <p className='mb-2'>{t('reportsUi.cacheHelpDescription')}</p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
