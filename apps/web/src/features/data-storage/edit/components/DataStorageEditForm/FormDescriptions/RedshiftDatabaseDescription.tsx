import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { useTranslation } from 'react-i18next';

/**
 * Accordion with information about Redshift database.
 */
export default function RedshiftDatabaseDescription() {
  const { t } = useTranslation();

  return (
    <Accordion variant='common' type='single' collapsible>
      <AccordionItem value='redshift-database-details'>
        <AccordionTrigger>{t('storageFieldHelp.redshiftDatabase.title')}</AccordionTrigger>
        <AccordionContent>
          <p className='text-sm leading-6 whitespace-pre-line'>
            {t('storageFieldHelp.redshiftDatabase.content')}
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
