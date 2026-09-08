import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { ExternalAnchor } from '@owox/ui/components/common/external-anchor';
import { useTranslation } from 'react-i18next';

/**
 * Accordion with step-by-step instructions for finding SQL warehouse HTTP path.
 */
export default function DatabricksHttpPathDescription() {
  const { t } = useTranslation();

  return (
    <Accordion variant='common' type='single' collapsible>
      <AccordionItem value='databricks-httppath-details'>
        <AccordionTrigger>{t('storageFieldHelp.databricksHttpPath.title')}</AccordionTrigger>
        <AccordionContent>
          <p className='text-sm leading-6 whitespace-pre-line'>
            {t('storageFieldHelp.databricksHttpPath.content')}
          </p>
          <div className='mt-4 text-sm'>
            {t('storageFieldHelp.common.moreDetails')}{' '}
            <ExternalAnchor
              className='underline'
              href='https://docs.databricks.com/sql/admin/sql-endpoints.html'
            >
              {t('storageFieldHelp.common.databricksWarehouseDocs')}
            </ExternalAnchor>
            .
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
