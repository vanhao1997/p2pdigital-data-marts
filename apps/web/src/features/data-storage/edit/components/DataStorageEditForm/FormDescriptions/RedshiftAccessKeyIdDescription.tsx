import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { useTranslation } from 'react-i18next';

/**
 * Accordion with information about AWS Access Key ID.
 */
export default function RedshiftAccessKeyIdDescription() {
  const { t } = useTranslation();

  return (
    <Accordion variant='common' type='single' collapsible>
      <AccordionItem value='redshift-access-key-details'>
        <AccordionTrigger>{t('storageFieldHelp.redshiftAccessKey.title')}</AccordionTrigger>
        <AccordionContent>
          <p className='text-sm leading-6 whitespace-pre-line'>
            {t('storageFieldHelp.redshiftAccessKey.content')}
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
