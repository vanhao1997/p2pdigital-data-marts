import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { useTranslation } from 'react-i18next';

/**
 * Accordion with information about the Data Studio JSON Config.
 */
export default function LookerStudioJsonConfigDescription() {
  const { t } = useTranslation();
  return (
    <Accordion variant='common' type='single' collapsible>
      <AccordionItem value='json-config-details'>
        <AccordionTrigger>{t('destinationForm.lookerJsonTitle')}</AccordionTrigger>
        <AccordionContent>
          <p className='mb-2'>{t('destinationForm.lookerJsonIntro')}</p>
          <ul className='list-inside space-y-2 text-sm'>
            <li>{t('destinationForm.lookerJsonCopy')}</li>
            <li>{t('destinationForm.lookerJsonRotate')}</li>
          </ul>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
