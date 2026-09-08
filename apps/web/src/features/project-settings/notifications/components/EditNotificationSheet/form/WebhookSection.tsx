import { Button } from '@owox/ui/components/button';
import { Input } from '@owox/ui/components/input';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { FormSection } from '@owox/ui/components/form';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { FieldItem, FieldLabel, FieldDescription } from './FormField';
import { useTranslation } from 'react-i18next';

interface WebhookSectionProps {
  webhookUrl: string;
  onWebhookUrlChange: (url: string) => void;
  onTest: () => void;
  isTesting?: boolean;
  disabled?: boolean;
  testError?: string | null;
  testSuccess?: boolean;
}

export function WebhookSection({
  webhookUrl,
  onWebhookUrlChange,
  onTest,
  isTesting,
  disabled,
  testError,
  testSuccess,
}: WebhookSectionProps) {
  const { t } = useTranslation();
  return (
    <FormSection title={t('notificationsPage.webhook', 'Webhook')}>
      <FieldItem>
        <FieldLabel
          tooltip={t(
            'notificationsPage.webhookTooltip',
            'Enter the URL where webhook notifications should be sent'
          )}
        >
          {t('notificationsPage.webhookUrl', 'Webhook URL')}
        </FieldLabel>
        <div className='flex gap-2'>
          <Input
            value={webhookUrl}
            onChange={e => {
              onWebhookUrlChange(e.target.value);
            }}
            placeholder='https://example.com/webhook'
            disabled={disabled}
            className='flex-1'
          />
          <Button
            type='button'
            variant='outline'
            onClick={onTest}
            disabled={(disabled ?? false) || (isTesting ?? false) || !webhookUrl}
          >
            {isTesting ? (
              <Loader2 className='h-4 w-4 animate-spin' />
            ) : (
              t('notificationsPage.test', 'Test')
            )}
          </Button>
        </div>
        {testError && (
          <p className='flex items-center gap-1.5 text-sm text-red-500'>
            <XCircle className='h-4 w-4 shrink-0' />
            {testError}
          </p>
        )}
        {testSuccess && !testError && (
          <p className='flex items-center gap-1.5 text-sm text-green-600'>
            <CheckCircle2 className='h-4 w-4 shrink-0' />
            {t('notificationsPage.testSuccess', 'Test webhook sent successfully')}
          </p>
        )}
        <FieldDescription>
          <Accordion variant='common' type='single' collapsible>
            <AccordionItem value='webhook-info'>
              <AccordionTrigger>
                {t('notificationsPage.howWebhooksWork', 'How webhooks work?')}
              </AccordionTrigger>
              <AccordionContent>
                {t(
                  'notificationsPage.webhookDescription',
                  'Webhooks send real-time notifications directly to your endpoint. The request payload contains event details in JSON format.'
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </FieldDescription>
      </FieldItem>
    </FormSection>
  );
}
