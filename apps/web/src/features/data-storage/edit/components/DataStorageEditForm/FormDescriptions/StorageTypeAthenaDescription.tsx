import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { ExternalAnchor } from '@owox/ui/components/common/external-anchor';
import { useTranslation } from 'react-i18next';

/**
 * Accordion with step-by-step instructions for enabling the AWS Athena API.
 */
export default function StorageTypeAthenaDescription() {
  const { t } = useTranslation();

  return (
    <Accordion variant='common' type='single' collapsible>
      <AccordionItem value='athena-api-details'>
        <AccordionTrigger>{t('storageHelp.athena.title')}</AccordionTrigger>
        <AccordionContent>
          <p className='mb-2'>{t('storageHelp.athena.intro')}</p>
          <p className='mb-2'>{t('storageHelp.athena.stepsIntro')}</p>
          <ol className='list-inside list-decimal space-y-2 text-sm'>
            <li>
              {t('storageHelp.athena.open')}{' '}
              <ExternalAnchor className='underline' href='https://console.aws.amazon.com/athena/'>
                {t('storageHelp.athena.console')}
              </ExternalAnchor>{' '}
              {t('storageHelp.athena.signIn')}
            </li>
            <li>{t('storageHelp.athena.resultLocation')}</li>
            <li>{t('storageHelp.athena.ready')}</li>
          </ol>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
