import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { ExternalAnchor } from '@owox/ui/components/common/external-anchor';
import { useTranslation } from 'react-i18next';

/**
 * Accordion with general information about AWS Redshift storage type.
 */
export default function StorageTypeRedshiftDescription() {
  const { t } = useTranslation();

  return (
    <Accordion variant='common' type='single' collapsible>
      <AccordionItem value='redshift-storage-details'>
        <AccordionTrigger>{t('storageHelp.redshift.title')}</AccordionTrigger>
        <AccordionContent>
          <p className='mb-2'>{t('storageHelp.redshift.intro')}</p>
          <p className='mb-2'>{t('storageHelp.redshift.options')}</p>
          <ul className='mb-2 list-inside list-disc space-y-1 text-sm'>
            <li>
              <strong>{t('storageHelp.redshift.serverlessLabel')}:</strong>{' '}
              {t('storageHelp.redshift.serverlessText')}
            </li>
            <li>
              <strong>{t('storageHelp.redshift.provisionedLabel')}:</strong>{' '}
              {t('storageHelp.redshift.provisionedText')}
            </li>
          </ul>
          <p className='text-sm'>
            {t('storageHelp.redshift.learnMore')}{' '}
            <ExternalAnchor
              className='underline'
              href='https://docs.aws.amazon.com/redshift/latest/mgmt/welcome.html'
            >
              {t('storageHelp.redshift.documentation')}
            </ExternalAnchor>
            .
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
