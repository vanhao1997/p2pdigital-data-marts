import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { CopyableField } from '@owox/ui/components/common/copyable-field';
import { useTranslation } from 'react-i18next';

interface DocumentLinkDescriptionProps {
  accessEmail?: string;
}

/**
 * Accordion with step-by-step instructions for copy and paste document link.
 */
export default function DocumentLinkDescription({ accessEmail }: DocumentLinkDescriptionProps) {
  const { t } = useTranslation();

  return (
    <Accordion variant='common' type='single' collapsible>
      <AccordionItem value='service-account-details'>
        <AccordionTrigger>{t('workflowHelp.documentLink.title')}</AccordionTrigger>
        <AccordionContent>
          <p className='mb-2'>
            {t('workflowHelp.documentLink.tipPrefix')}{' '}
            <strong>{t('workflowHelp.documentLink.createDocument')}</strong>{' '}
            {t('workflowHelp.documentLink.tipMiddle')}
          </p>
          <p className='mb-2'>{t('workflowHelp.documentLink.intro')}</p>
          <ol className='list-inside list-decimal space-y-2 text-sm'>
            <li>{t('workflowHelp.documentLink.step1')}</li>
            <li>
              {accessEmail ? (
                <>
                  {t('workflowHelp.documentLink.sharePrefix')}{' '}
                  <strong>{t('workflowHelp.documentLink.shareAccess')}</strong>{' '}
                  {t('workflowHelp.documentLink.shareSuffix')}
                  <CopyableField
                    value={accessEmail}
                    className='bg-background mt-1 w-fit max-w-full'
                  >
                    {accessEmail}
                  </CopyableField>
                </>
              ) : (
                <>{t('workflowHelp.documentLink.shareNoEmail')}</>
              )}
            </li>
            <li>{t('workflowHelp.documentLink.step3')}</li>
            <li>{t('workflowHelp.documentLink.step4')}</li>
          </ol>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
