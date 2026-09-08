import {
  Accordion,
  AccordionItem,
  AccordionContent,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { ExternalAnchor } from '@owox/ui/components/common/external-anchor';
import { useTranslation } from 'react-i18next';

/**
 * Description for Databricks storage type.
 */
export default function StorageTypeDatabricksDescription() {
  const { t } = useTranslation();

  return (
    <Accordion variant='common' type='single' collapsible>
      <AccordionItem value='databricks-setup'>
        <AccordionTrigger>{t('storageHelp.databricks.title')}</AccordionTrigger>
        <AccordionContent>
          <p className='mb-2'>{t('storageHelp.databricks.intro')}</p>
          <p className='mb-2'>{t('storageHelp.databricks.connection')}</p>
          <p className='mb-2'>
            {t('storageHelp.databricks.learnMore')}{' '}
            <ExternalAnchor
              className='underline'
              href='https://docs.p2pdigital.io.vn/docs/storages/supported-storages/databricks/'
            >
              {t('storageHelp.databricks.documentation')}
            </ExternalAnchor>
            .
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
