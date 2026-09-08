import { AccordionItem, AccordionTrigger, AccordionContent } from '@owox/ui/components/accordion';
import { useTranslation } from 'react-i18next';

export default function ODataDescription() {
  const { t } = useTranslation();
  return (
    <AccordionItem value='odata-details'>
      <AccordionTrigger>{t('destinationHelp.odata.title')}</AccordionTrigger>
      <AccordionContent>
        <p className='mb-2'>{t('destinationHelp.odata.description')}</p>
        <p className='mb-2'>{t('destinationHelp.odata.comingSoon')}</p>
      </AccordionContent>
    </AccordionItem>
  );
}
