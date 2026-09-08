import { FormSection } from '@owox/ui/components/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@owox/ui/components/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { FieldItem, FieldLabel, FieldDescription } from './FormField';
import { GROUPING_DELAY_OPTIONS } from '../../../types';
import { useTranslation } from 'react-i18next';

interface GroupingDelaySectionProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function GroupingDelaySection({ value, onChange, disabled }: GroupingDelaySectionProps) {
  const { t } = useTranslation();
  return (
    <FormSection title={t('notificationsPage.delay', 'Delay')}>
      <FieldItem>
        <FieldLabel
          tooltip={t(
            'notificationsPage.groupingTooltip',
            'Select how long to wait before sending a grouped email'
          )}
        >
          {t('notificationsPage.groupingMultiple', 'Grouping multiple notifications')}
        </FieldLabel>
        <Select value={value} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger className='w-full'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GROUPING_DELAY_OPTIONS.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldDescription>
          <Accordion variant='common' type='single' collapsible>
            <AccordionItem value='grouping-delay-info'>
              <AccordionTrigger>
                {t('notificationsPage.howGroupingWorks', 'How grouping works?')}
              </AccordionTrigger>
              <AccordionContent>
                {t(
                  'notificationsPage.groupingDescription',
                  'If multiple notifications are triggered within this time window, they are sent as a single email to keep your inbox tidy. Only email notifications are grouped.'
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </FieldDescription>
      </FieldItem>
    </FormSection>
  );
}
