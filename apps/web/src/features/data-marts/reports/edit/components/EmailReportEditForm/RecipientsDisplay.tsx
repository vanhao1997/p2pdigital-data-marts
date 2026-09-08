import { FormLabel } from '@owox/ui/components/form';
import { CopyableField } from '@owox/ui/components/common/copyable-field';
import { isEmailCredentials } from '../../../../../data-destination/shared/model/types/email-credentials.ts';
import { isGoogleChatDataDestination, type DataDestination } from '../../../../../data-destination';
import { useTranslation } from 'react-i18next';

export interface RecipientsDisplayProps {
  destination: DataDestination | null;
}

export const RecipientsDisplay = ({ destination }: RecipientsDisplayProps) => {
  const { t } = useTranslation();
  if (!destination) return null;
  if (
    isGoogleChatDataDestination(destination) &&
    destination.credentials.deliveryMethod === 'webhook'
  ) {
    return null;
  }

  const creds = destination.credentials;
  const recipients = isEmailCredentials(creds) && creds.to.length ? creds.to.join(', ') : '';

  return (
    <div className='mt-2 flex flex-col gap-1'>
      <FormLabel>{t('recipients.label')}</FormLabel>
      <CopyableField doNotTruncateContent={true} value={recipients}>
        {recipients || t('recipients.empty')}
      </CopyableField>
    </div>
  );
};
