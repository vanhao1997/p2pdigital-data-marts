import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { ExternalAnchor } from '@owox/ui/components/common/external-anchor';
import { useTranslation } from 'react-i18next';

/**
 * Accordion with step-by-step instructions for obtaining a Google Service Account JSON key.
 */
export default function GoogleSheetsServiceAccountDescription() {
  const { t } = useTranslation();
  return (
    <Accordion variant='common' type='single' collapsible>
      <AccordionItem value='service-account-details'>
        <AccordionTrigger>{t('destinationHelp.googleSheetsServiceAccount.title')}</AccordionTrigger>
        <AccordionContent>
          <p className='mb-2'>{t('destinationHelp.googleSheetsServiceAccount.intro')}</p>
          <p className='mb-2'>{t('destinationHelp.googleSheetsServiceAccount.stepsIntro')}</p>
          <ol className='list-inside list-decimal space-y-2 text-sm'>
            <li>
              {t('destinationHelp.googleSheetsServiceAccount.goTo')}{' '}
              <ExternalAnchor href='https://console.cloud.google.com/iam-admin/serviceaccounts'>
                {t('destinationHelp.googleSheetsServiceAccount.console')}
              </ExternalAnchor>{' '}
              .
            </li>
            <li>
              {t('destinationHelp.googleSheetsServiceAccount.openIam')}{' '}
              <strong>{t('destinationHelp.googleSheetsServiceAccount.iamPath')}</strong>.
            </li>
            <li>{t('destinationHelp.googleSheetsServiceAccount.createOrSelect')}</li>
            <li>
              {t('destinationHelp.googleSheetsServiceAccount.openKeys')}{' '}
              <strong>{t('destinationHelp.googleSheetsServiceAccount.keys')}</strong>{' '}
              {t('destinationHelp.googleSheetsServiceAccount.click')}{' '}
              <strong>{t('destinationHelp.googleSheetsServiceAccount.addKey')}</strong>,{' '}
              {t('destinationHelp.googleSheetsServiceAccount.selectCreate')}{' '}
              <strong>{t('destinationHelp.googleSheetsServiceAccount.createKey')}</strong>.
            </li>
            <li>
              {t('destinationHelp.googleSheetsServiceAccount.choose')} <strong>JSON</strong>{' '}
              {t('destinationHelp.googleSheetsServiceAccount.formatAndClick')}{' '}
              <strong>{t('destinationHelp.googleSheetsServiceAccount.create')}</strong>.
            </li>
            <li>{t('destinationHelp.googleSheetsServiceAccount.paste')}</li>
          </ol>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
