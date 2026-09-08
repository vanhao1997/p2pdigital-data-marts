import { Switch } from '@owox/ui/components/switch';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { FieldItem, FieldLabel, FieldDescription } from './FormField';
import { useTranslation } from 'react-i18next';

interface EnabledFieldProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
}

export function EnabledField({ enabled, onChange, disabled }: EnabledFieldProps) {
  const { t } = useTranslation();
  return (
    <FieldItem>
      <FieldLabel
        htmlFor='enabled'
        tooltip={t('notificationsPage.enabledTooltip', 'Enable or disable this notification')}
      >
        <div className='flex items-center gap-2'>
          <Switch id='enabled' checked={enabled} onCheckedChange={onChange} disabled={disabled} />
          <span>{t('common.enabled', 'Enabled')}</span>
        </div>
      </FieldLabel>
      <FieldDescription>
        <Accordion variant='common' type='single' collapsible>
          <AccordionItem value='how-it-works'>
            <AccordionTrigger>
              {t('notificationsPage.howItWorks', 'How it works?')}
            </AccordionTrigger>
            <AccordionContent>
              {t(
                'notificationsPage.enabledDescription',
                'When enabled, notifications will be sent to the selected recipients when events occur. Email notifications are grouped together based on the grouping delay setting.'
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </FieldDescription>
    </FieldItem>
  );
}
