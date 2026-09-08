import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { ExternalAnchor } from '@owox/ui/components/common/external-anchor';
import { useTranslation } from 'react-i18next';

/**
 * Accordion with step-by-step instructions for Snowflake Account.
 */
export default function SnowflakeAccountDescription() {
  const { t } = useTranslation();

  return (
    <Accordion variant='common' type='single' collapsible>
      <AccordionItem value='snowflake-account-details'>
        <AccordionTrigger>{t('storageFieldHelp.snowflakeAccount.title')}</AccordionTrigger>
        <AccordionContent>
          <p className='text-sm leading-6 whitespace-pre-line'>
            {t('storageFieldHelp.snowflakeAccount.content')}
          </p>
          <div className='mt-4 text-sm'>
            {t('storageFieldHelp.common.moreDetails')}{' '}
            <ExternalAnchor
              className='underline'
              href='https://docs.p2pdigital.io.vn/docs/storages/supported-storages/snowflake/'
            >
              {t('storageHelp.snowflake.documentation')}
            </ExternalAnchor>
            .
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
