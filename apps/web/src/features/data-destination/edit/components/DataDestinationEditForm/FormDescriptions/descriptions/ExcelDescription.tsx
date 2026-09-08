import { AccordionItem, AccordionTrigger, AccordionContent } from '@owox/ui/components/accordion';
import { useTranslation } from 'react-i18next';

export default function ExcelDescription() {
  const { t } = useTranslation();
  return (
    <AccordionItem value='excel-details'>
      <AccordionTrigger>{t('destinationHelp.excel.title')}</AccordionTrigger>
      <AccordionContent>
        <p className='mb-2'>{t('destinationHelp.excel.setup')}</p>
        <p className='mb-2'>{t('destinationHelp.excel.credentials')}</p>
      </AccordionContent>
    </AccordionItem>
  );
}
