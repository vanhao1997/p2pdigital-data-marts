import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { useTranslation } from 'react-i18next';

/**
 * Accordion with step-by-step instructions for Snowflake Private Key Passphrase.
 */
export default function SnowflakePassphraseDescription() {
  const { t } = useTranslation();

  return (
    <Accordion variant='common' type='single' collapsible>
      <AccordionItem value='snowflake-passphrase-details'>
        <AccordionTrigger>{t('storageFieldHelp.snowflakePassphrase.title')}</AccordionTrigger>
        <AccordionContent>
          <p className='mb-2'>{t('storageFieldHelp.snowflakePassphrase.intro')}</p>
          <p className='mb-2'>{t('storageFieldHelp.snowflakePassphrase.stepsIntro')}</p>
          <ul className='list-inside list-disc space-y-2 text-sm'>
            <li>{t('storageFieldHelp.snowflakePassphrase.step1')}</li>
            <li>{t('storageFieldHelp.snowflakePassphrase.step2')}</li>
            <li>{t('storageFieldHelp.snowflakePassphrase.step3')}</li>
            <li>{t('storageFieldHelp.snowflakePassphrase.step4')}</li>
            <li>{t('storageFieldHelp.snowflakePassphrase.step5')}</li>
          </ul>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
