import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { ExternalAnchor } from '@owox/ui/components/common/external-anchor';
import { useTranslation } from 'react-i18next';

/**
 * Accordion with step-by-step instructions for generating Personal Access Token.
 */
export default function DatabricksTokenDescription() {
  const { t } = useTranslation();

  return (
    <Accordion variant='common' type='single' collapsible>
      <AccordionItem value='databricks-token-details'>
        <AccordionTrigger>{t('storageFieldHelp.databricksToken.title')}</AccordionTrigger>
        <AccordionContent>
          <p className='text-sm leading-6 whitespace-pre-line'>
            {t('storageFieldHelp.databricksToken.content')}
          </p>
          <div className='mt-4 text-sm'>
            {t('storageFieldHelp.common.moreDetails')}{' '}
            <ExternalAnchor
              className='underline'
              href='https://docs.databricks.com/dev-tools/auth/pat.html'
            >
              {t('storageFieldHelp.common.databricksTokenDocs')}
            </ExternalAnchor>
            .
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
