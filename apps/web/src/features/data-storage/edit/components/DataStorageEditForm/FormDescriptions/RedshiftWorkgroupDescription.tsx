import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { useTranslation } from 'react-i18next';

/**
 * Accordion with information about Redshift Serverless workgroup.
 */
export default function RedshiftWorkgroupDescription() {
  const { t } = useTranslation();

  return (
    <Accordion variant='common' type='single' collapsible>
      <AccordionItem value='redshift-workgroup-details'>
        <AccordionTrigger>{t('storageFieldHelp.redshiftWorkgroup.title')}</AccordionTrigger>
        <AccordionContent>
          <p className='text-sm leading-6 whitespace-pre-line'>
            {t('storageFieldHelp.redshiftWorkgroup.content')}
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
