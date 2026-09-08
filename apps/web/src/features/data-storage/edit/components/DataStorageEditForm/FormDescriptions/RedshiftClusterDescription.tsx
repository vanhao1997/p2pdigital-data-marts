import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { useTranslation } from 'react-i18next';

/**
 * Accordion with information about Redshift provisioned cluster identifier.
 */
export default function RedshiftClusterDescription() {
  const { t } = useTranslation();

  return (
    <Accordion variant='common' type='single' collapsible>
      <AccordionItem value='redshift-cluster-details'>
        <AccordionTrigger>{t('storageFieldHelp.redshiftCluster.title')}</AccordionTrigger>
        <AccordionContent>
          <p className='text-sm leading-6 whitespace-pre-line'>
            {t('storageFieldHelp.redshiftCluster.content')}
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
