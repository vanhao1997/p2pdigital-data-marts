import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { useTranslation } from 'react-i18next';

/**
 * Accordion with a brief explanation of the available BigQuery authentication methods.
 */
export default function GoogleBigQueryAuthMethodDescription() {
  const { t } = useTranslation();

  return (
    <Accordion variant='common' type='single' collapsible>
      <AccordionItem value='bigquery-auth-method-details'>
        <AccordionTrigger>{t('storageHelp.bigQueryAuth.title')}</AccordionTrigger>
        <AccordionContent>
          <p className='mb-2'>{t('storageHelp.bigQueryAuth.intro')}</p>
          <div className='space-y-3 text-sm'>
            <div>
              <strong className='font-medium'>{t('storageHelp.bigQueryAuth.oauthLabel')}</strong>
              <p className='mt-1'>{t('storageHelp.bigQueryAuth.oauthText')}</p>
            </div>
            <div>
              <strong className='font-medium'>
                {t('storageHelp.bigQueryAuth.serviceAccountLabel')}
              </strong>
              <p className='mt-1'>{t('storageHelp.bigQueryAuth.serviceAccountText')}</p>
            </div>
          </div>
          <p className='mt-3 text-sm'>
            {t('storageHelp.bigQueryAuth.permissionsPrefix')} <strong>BigQuery Data Editor</strong>{' '}
            (<code>roles/bigquery.dataEditor</code>) {t('storageHelp.bigQueryAuth.permissionsAnd')}{' '}
            <strong>BigQuery Job User</strong> (<code>roles/bigquery.jobUser</code>){' '}
            {t('storageHelp.bigQueryAuth.permissionsSuffix')}
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
