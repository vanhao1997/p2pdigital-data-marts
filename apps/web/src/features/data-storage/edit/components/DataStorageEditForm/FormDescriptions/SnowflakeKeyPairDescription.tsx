import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { ExternalAnchor } from '@owox/ui/components/common/external-anchor';
import { useTranslation } from 'react-i18next';

/**
 * Accordion with step-by-step instructions for Snowflake Key Pair setup.
 */
export default function SnowflakeKeyPairDescription() {
  const { t } = useTranslation();

  return (
    <Accordion variant='common' type='single' collapsible>
      <AccordionItem value='snowflake-keypair-details'>
        <AccordionTrigger>{t('storageFieldHelp.snowflakeKeyPair.title')}</AccordionTrigger>
        <AccordionContent>
          <p className='text-sm leading-6 whitespace-pre-line'>
            {t('storageFieldHelp.snowflakeKeyPair.content')}
          </p>
          <p className='mt-2 text-xs'>
            {t('storageFieldHelp.common.moreDetails')}{' '}
            <ExternalAnchor
              className='underline'
              href='https://docs.snowflake.com/en/user-guide/key-pair-auth.html'
            >
              {t('storageFieldHelp.common.snowflakeKeyPairDocs')}
            </ExternalAnchor>
            .
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
