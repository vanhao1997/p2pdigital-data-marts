import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { useTranslation } from 'react-i18next';

/**
 * Accordion with step-by-step instructions for Snowflake Warehouse.
 */
export default function SnowflakeWarehouseDescription() {
  const { t } = useTranslation();

  return (
    <Accordion variant='common' type='single' collapsible>
      <AccordionItem value='snowflake-warehouse-details'>
        <AccordionTrigger>{t('storageFieldHelp.snowflakeWarehouse.title')}</AccordionTrigger>
        <AccordionContent>
          <p className='mb-2'>{t('storageFieldHelp.snowflakeWarehouse.intro')}</p>
          <p className='mb-2'>{t('storageFieldHelp.snowflakeWarehouse.stepsIntro')}</p>
          <ol className='list-inside list-decimal space-y-2 text-sm'>
            <li>{t('storageFieldHelp.snowflakeWarehouse.step1')}</li>
            <li>{t('storageFieldHelp.snowflakeWarehouse.step2')}</li>
            <li>{t('storageFieldHelp.snowflakeWarehouse.step3')}</li>
            <li>{t('storageFieldHelp.snowflakeWarehouse.step4')}</li>
          </ol>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
