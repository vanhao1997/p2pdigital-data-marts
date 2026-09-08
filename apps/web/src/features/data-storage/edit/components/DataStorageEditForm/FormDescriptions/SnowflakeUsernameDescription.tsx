import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { useTranslation } from 'react-i18next';

/**
 * Accordion with step-by-step instructions for Snowflake Username.
 */
export default function SnowflakeUsernameDescription() {
  const { t } = useTranslation();

  return (
    <Accordion variant='common' type='single' collapsible>
      <AccordionItem value='snowflake-username-details'>
        <AccordionTrigger>{t('storageFieldHelp.snowflakeUsername.title')}</AccordionTrigger>
        <AccordionContent>
          <p className='mb-2'>{t('storageFieldHelp.snowflakeUsername.intro')}</p>
          <p className='mb-2'>{t('storageFieldHelp.snowflakeUsername.stepsIntro')}</p>
          <ul className='list-inside list-disc space-y-2 text-sm'>
            <li>{t('storageFieldHelp.snowflakeUsername.step1')}</li>
            <li>{t('storageFieldHelp.snowflakeUsername.step2')}</li>
            <li>{t('storageFieldHelp.snowflakeUsername.step3')}</li>
            <li>{t('storageFieldHelp.snowflakeUsername.step4')}</li>
          </ul>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
