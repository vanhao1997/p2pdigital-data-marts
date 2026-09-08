import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { ExternalAnchor } from '@owox/ui/components/common/external-anchor';
import { useTranslation } from 'react-i18next';

/**
 * Accordion with step-by-step instructions for Snowflake Authentication Method.
 */
export default function SnowflakeAuthMethodDescription() {
  const { t } = useTranslation();

  return (
    <Accordion variant='common' type='single' collapsible>
      <AccordionItem value='snowflake-auth-method-details'>
        <AccordionTrigger>{t('storageFieldHelp.snowflakeAuthMethod.title')}</AccordionTrigger>
        <AccordionContent>
          <p className='text-sm leading-6 whitespace-pre-line'>
            {t('storageFieldHelp.snowflakeAuthMethod.content')}
          </p>
          <p className='mt-2 text-sm'>
            {t('storageFieldHelp.common.moreDetails')}{' '}
            <ExternalAnchor
              className='underline'
              href='https://docs.p2pdigital.io.vn/docs/storages/supported-storages/snowflake/'
            >
              {t('storageFieldHelp.common.snowflakeAuthDocs')}
            </ExternalAnchor>
            .
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
