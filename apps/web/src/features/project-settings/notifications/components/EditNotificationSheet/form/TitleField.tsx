import { Input } from '@owox/ui/components/input';
import { FieldItem, FieldLabel } from './FormField';
import { useTranslation } from 'react-i18next';

interface TitleFieldProps {
  title: string;
}

export function TitleField({ title }: TitleFieldProps) {
  const { t } = useTranslation();
  return (
    <FieldItem>
      <FieldLabel
        tooltip={t(
          'notificationsPage.titleTooltip',
          'The name of this notification. Disabled for service predefined notifications'
        )}
      >
        {t('notificationsPage.notificationTitle', 'Notification title')}
      </FieldLabel>
      <Input value={title} disabled />
    </FieldItem>
  );
}
