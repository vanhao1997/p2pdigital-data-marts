import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { Separator } from '@owox/ui/components/separator';
import { ExternalAnchor } from '@owox/ui/components/common/external-anchor';
import { useTranslation } from 'react-i18next';

/**
 * Accordion with step-by-step instructions for AccessKeyId.
 */
export default function AthenaAccessKeyIdDescription() {
  const { t } = useTranslation();

  return (
    <Accordion variant='common' type='single' collapsible>
      <AccordionItem value='athena-access-key-id-details'>
        <AccordionTrigger>{t('storageFieldHelp.athenaAccessKey.title')}</AccordionTrigger>
        <AccordionContent>
          <p className='text-sm leading-6 whitespace-pre-line'>
            {t('storageFieldHelp.athenaAccessKey.content')}
          </p>
          <p className='mb-4 text-sm'>
            {t('storageFieldHelp.common.learnMore')}&nbsp;
            <ExternalAnchor
              className='underline'
              href='https://docs.p2pdigital.io.vn/docs/storages/supported-storages/aws-athena/?utm_source=owox_data_marts&utm_medium=storage_enity&utm_campaign=tooltip_aws'
            >
              {t('storageFieldHelp.common.documentation')}
            </ExternalAnchor>
            .
          </p>
          <Separator className='my-4' />
          <ExternalAnchor
            className='underline'
            href='https://console.aws.amazon.com/iam/home#/security_credentials'
          >
            {t('storageFieldHelp.common.iamCredentials')}
          </ExternalAnchor>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
