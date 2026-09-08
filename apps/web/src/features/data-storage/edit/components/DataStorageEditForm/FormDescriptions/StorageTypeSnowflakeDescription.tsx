import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { ExternalAnchor } from '@owox/ui/components/common/external-anchor';
import { useTranslation } from 'react-i18next';

const StorageTypeSnowflakeDescription: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Accordion variant='common' type='single' collapsible>
      <AccordionItem value='snowflake-setup'>
        <AccordionTrigger>{t('storageHelp.snowflake.title')}</AccordionTrigger>
        <AccordionContent>
          <p className='mb-2'>{t('storageHelp.snowflake.intro')}</p>
          <p className='mb-2'>{t('storageHelp.snowflake.stepsIntro')}</p>
          <ol className='list-inside list-decimal space-y-2 text-sm'>
            <li>
              {t('storageHelp.snowflake.signupPrefix')}{' '}
              <ExternalAnchor className='underline' href='https://signup.snowflake.com/'>
                {t('storageHelp.snowflake.accountLink')}
              </ExternalAnchor>{' '}
              {t('storageHelp.snowflake.accountSuffix')}
            </li>
            <li>{t('storageHelp.snowflake.privileges')}</li>
            <li>{t('storageHelp.snowflake.auth')}</li>
            <li>{t('storageHelp.snowflake.connection')}</li>
            <li>{t('storageHelp.snowflake.path')}</li>
          </ol>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

export default StorageTypeSnowflakeDescription;
