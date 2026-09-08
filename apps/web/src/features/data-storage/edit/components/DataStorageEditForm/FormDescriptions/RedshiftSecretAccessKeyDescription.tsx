import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { useTranslation } from 'react-i18next';

/**
 * Accordion with information about AWS Secret Access Key.
 */
export default function RedshiftSecretAccessKeyDescription() {
  const { t } = useTranslation();

  return (
    <Accordion variant='common' type='single' collapsible>
      <AccordionItem value='redshift-secret-key-details'>
        <AccordionTrigger>{t('storageFieldHelp.redshiftSecret.title')}</AccordionTrigger>
        <AccordionContent>
          <p className='text-sm leading-6 whitespace-pre-line'>
            {t('storageFieldHelp.redshiftSecret.content')}
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
