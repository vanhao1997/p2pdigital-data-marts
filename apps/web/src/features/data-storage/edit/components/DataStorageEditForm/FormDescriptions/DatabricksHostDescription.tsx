import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { ExternalAnchor } from '@owox/ui/components/common/external-anchor';
import { useTranslation } from 'react-i18next';

/**
 * Accordion with step-by-step instructions for finding Databricks workspace URL.
 */
export default function DatabricksHostDescription() {
  const { t } = useTranslation();

  return (
    <Accordion variant='common' type='single' collapsible>
      <AccordionItem value='databricks-host-details'>
        <AccordionTrigger>{t('storageFieldHelp.databricksHost.title')}</AccordionTrigger>
        <AccordionContent>
          <p className='text-sm leading-6 whitespace-pre-line'>
            {t('storageFieldHelp.databricksHost.content')}
          </p>
          <div className='mt-4 text-sm'>
            {t('storageFieldHelp.common.moreDetails')}{' '}
            <ExternalAnchor
              className='underline'
              href='https://docs.databricks.com/workspace/workspace-details.html'
            >
              {t('storageFieldHelp.common.databricksDocs')}
            </ExternalAnchor>
            .
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
