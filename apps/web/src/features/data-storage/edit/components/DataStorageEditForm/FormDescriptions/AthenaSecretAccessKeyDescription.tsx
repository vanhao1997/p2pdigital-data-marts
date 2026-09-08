import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { ExternalAnchor } from '@owox/ui/components/common/external-anchor';
import { useTranslation } from 'react-i18next';

/**
 * Accordion with step-by-step instructions for SecretAccessKey.
 */
export default function AthenaSecretAccessKeyDescription() {
  const { t } = useTranslation();

  return (
    <Accordion variant='common' type='single' collapsible>
      <AccordionItem value='athena-secret-access-key-details'>
        <AccordionTrigger>{t('storageFieldHelp.athenaSecret.title')}</AccordionTrigger>
        <AccordionContent>
          <p className='text-sm leading-6 whitespace-pre-line'>
            {t('storageFieldHelp.athenaSecret.content')}
          </p>
          <ExternalAnchor
            className='mt-2 inline-block underline'
            href='https://console.aws.amazon.com/iam/home#/security_credentials'
          >
            {t('storageFieldHelp.common.iamCredentials')}
          </ExternalAnchor>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
