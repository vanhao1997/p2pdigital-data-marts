import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { ExternalAnchor } from '@owox/ui/components/common/external-anchor';
import { useTranslation } from 'react-i18next';

export default function GoogleSheetsServiceAccountDescription() {
  const { t } = useTranslation();
  return (
    <Accordion variant='common' type='single' collapsible className='text-sm'>
      <AccordionItem value='google-sheets-service-account-details'>
        <AccordionTrigger className='text-sm'>
          {t('destinationHelp.googleSheetsServiceAccount.title')}
        </AccordionTrigger>
        <AccordionContent>
          <p className='mb-2'>{t('destinationHelp.googleSheetsServiceAccount.intro')}</p>
          <p className='mb-2'>{t('destinationHelp.googleSheetsServiceAccount.stepsIntro')}</p>
          <ol className='list-inside list-decimal space-y-2 text-sm'>
            <li>
              {t('destinationHelp.googleSheetsServiceAccount.goTo')}{' '}
              <ExternalAnchor href='https://console.cloud.google.com/iam-admin/serviceaccounts'>
                {t('destinationHelp.googleSheetsServiceAccount.console')}
              </ExternalAnchor>
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
            <li>
              {t('destinationHelp.googleSheetsServiceAccount.sharePrefix')}{' '}
              <code className='bg-muted rounded px-1 py-0.5'>client_email</code>{' '}
              {t('destinationHelp.googleSheetsServiceAccount.shareSuffix')}
            </li>
          </ol>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
