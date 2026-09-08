import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { ExternalAnchor } from '@owox/ui/components/common/external-anchor';
import { useTranslation } from 'react-i18next';

/**
 * Accordion with step-by-step instructions for Snowflake Password.
 */
export default function SnowflakePasswordDescription() {
  const { t } = useTranslation();

  return (
    <Accordion variant='common' type='single' collapsible>
      <AccordionItem value='snowflake-password-details'>
        <AccordionTrigger>{t('storageFieldHelp.snowflakePassword.title')}</AccordionTrigger>
        <AccordionContent>
          <p className='mb-2'>{t('storageFieldHelp.snowflakePassword.intro')}</p>
          <p className='mb-2'>{t('storageFieldHelp.snowflakePassword.securityTips')}</p>
          <ul className='list-inside list-disc space-y-2 text-sm'>
            <li>
              {t('storageFieldHelp.snowflakePassword.step1Prefix')}{' '}
              <b>{t('storageFieldHelp.snowflakePassword.step1Path')}</b>{' '}
              {t('storageFieldHelp.snowflakePassword.step1Suffix')}
            </li>
            <li>
              {t('storageFieldHelp.snowflakePassword.step2Prefix')}{' '}
              <ExternalAnchor
                className='underline'
                href='https://docs.snowflake.com/en/user-guide/key-pair-auth.html'
              >
                {t('storageFieldHelp.common.keyPairAuthentication')}
              </ExternalAnchor>{' '}
              {t('storageFieldHelp.snowflakePassword.step2Suffix')}
            </li>
            <li>{t('storageFieldHelp.snowflakePassword.step3')}</li>
          </ul>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
