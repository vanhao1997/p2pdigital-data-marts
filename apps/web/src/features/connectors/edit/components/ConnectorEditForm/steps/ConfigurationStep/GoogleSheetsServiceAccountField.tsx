import { useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@owox/ui/components/button';
import { Input } from '@owox/ui/components/input';
import { FileDropTextarea } from '@owox/ui/components/file-drop-textarea';
import { AppWizardStepLabel } from '@owox/ui/components/common/wizard';
import { ExternalAnchor } from '@owox/ui/components/common/external-anchor';
import { toast } from 'sonner';
import { Check, Copy } from 'lucide-react';
import { SECRET_MASK } from '../../../../../../../shared/constants/secrets';
import { getServiceAccountLink } from '../../../../../../../utils';
import GoogleSheetsServiceAccountDescription from '../../../../../shared/components/FormDescriptions/GoogleSheetsServiceAccountDescription';
import { isValidGoogleSheetsServiceAccountKey } from '../../../../../shared/utils/google-sheets-fields.utils';

interface GoogleSheetsServiceAccountFieldProps {
  itemName: string;
  title?: string;
  description?: string;
  value?: unknown;
  metadata?: ServiceAccountMetadata;
  onValueChange: (value: string, metadata: ServiceAccountMetadata) => void;
  isEditingExisting: boolean;
}

interface ServiceAccountMetadata {
  email?: string;
  clientId?: string;
  projectId?: string;
}

function getMetadataFromJson(value: string): ServiceAccountMetadata {
  try {
    const parsed = JSON.parse(value) as {
      client_email?: unknown;
      client_id?: unknown;
      project_id?: unknown;
    };

    return {
      email: typeof parsed.client_email === 'string' ? parsed.client_email : undefined,
      clientId: typeof parsed.client_id === 'string' ? parsed.client_id : undefined,
      projectId: typeof parsed.project_id === 'string' ? parsed.project_id : undefined,
    };
  } catch {
    return {};
  }
}

function getLinkFromMetadata(metadata?: ServiceAccountMetadata) {
  if (!metadata?.email || !metadata.clientId || !metadata.projectId) {
    return null;
  }

  return {
    email: metadata.email,
    url: `https://console.cloud.google.com/iam-admin/serviceaccounts/details/${metadata.clientId}?project=${metadata.projectId}`,
  };
}

export function GoogleSheetsServiceAccountField({
  itemName,
  title,
  description,
  value,
  metadata,
  onValueChange,
  isEditingExisting,
}: GoogleSheetsServiceAccountFieldProps) {
  const { t } = useTranslation();
  const serviceAccountValue = typeof value === 'string' ? value : '';
  const [isEditing, setIsEditing] = useState(false);
  const [stashedValue, setStashedValue] = useState(serviceAccountValue);
  const [stashedMetadata, setStashedMetadata] = useState<ServiceAccountMetadata>(metadata ?? {});
  const [isCopied, setIsCopied] = useState(false);

  const isMasked = serviceAccountValue === SECRET_MASK;
  const serviceAccountLink =
    !isMasked && serviceAccountValue
      ? isValidGoogleSheetsServiceAccountKey(serviceAccountValue)
        ? getServiceAccountLink(serviceAccountValue)
        : null
      : getLinkFromMetadata(metadata);
  const canShowMaskedState = !isEditing && isMasked && serviceAccountLink === null;
  const canShowServiceAccount = !isEditing && serviceAccountLink !== null;
  const canShowSummary = canShowMaskedState || canShowServiceAccount;

  const handleEdit = () => {
    setStashedValue(serviceAccountValue);
    setStashedMetadata(metadata ?? {});
    setIsEditing(true);
    onValueChange('', metadata ?? {});
  };

  const handleCancel = () => {
    setIsEditing(false);
    onValueChange(stashedValue || (isEditingExisting ? SECRET_MASK : ''), stashedMetadata);
  };

  const handleServiceAccountChange = (nextValue: string) => {
    onValueChange(nextValue, getMetadataFromJson(nextValue));
    if (isValidGoogleSheetsServiceAccountKey(nextValue) && getServiceAccountLink(nextValue)) {
      setIsEditing(false);
    }
  };

  const handleClear = () => {
    setStashedValue(serviceAccountValue);
    setStashedMetadata(metadata ?? {});
    setIsEditing(true);
    onValueChange('', {});
  };

  return (
    <div className='mb-4'>
      <div className='flex items-center justify-between'>
        <AppWizardStepLabel
          htmlFor={itemName}
          required
          tooltip={description}
          className='mb-2 justify-start'
        >
          {title ?? t('connectorWizard.serviceAccount')}
        </AppWizardStepLabel>
        {canShowSummary && (
          <div className='flex items-center gap-1'>
            <Button variant='ghost' size='sm' type='button' onClick={handleEdit}>
              {t('common.edit')}
            </Button>
            <Button variant='ghost' size='sm' type='button' onClick={handleClear}>
              {t('common.clear', 'Clear')}
            </Button>
          </div>
        )}
        {isEditing && (
          <Button variant='ghost' size='sm' type='button' onClick={handleCancel}>
            {t('common.cancel')}
          </Button>
        )}
      </div>

      {canShowMaskedState ? (
        <Input
          id={itemName}
          type='password'
          value={SECRET_MASK}
          readOnly
          disabled
          autoComplete='new-password'
        />
      ) : canShowServiceAccount ? (
        <div className='flex items-center gap-2'>
          <ExternalAnchor href={serviceAccountLink.url} variant='field' className='flex-1 truncate'>
            {serviceAccountLink.email}
          </ExternalAnchor>
          <button
            type='button'
            onClick={() => {
              void navigator.clipboard.writeText(serviceAccountLink.email);
              setIsCopied(true);
              setTimeout(() => {
                setIsCopied(false);
              }, 2000);
            }}
            className='text-muted-foreground hover:text-foreground hover:bg-accent shrink-0 rounded-md p-1 transition-colors'
            aria-label={t('connectorWizard.copyServiceAccountEmail')}
          >
            {isCopied ? <Check className='h-4 w-4 text-green-500' /> : <Copy className='h-4 w-4' />}
          </button>
        </div>
      ) : (
        <FileDropTextarea
          id={itemName}
          name={itemName}
          className='min-h-[150px] font-mono'
          rows={8}
          value={serviceAccountValue === SECRET_MASK ? '' : serviceAccountValue}
          placeholder={t('connectorWizard.serviceAccountPlaceholder')}
          autoComplete='off'
          autoCorrect='off'
          autoCapitalize='off'
          spellCheck={false}
          messages={{
            multipleFiles: t('fileDrop.multipleFiles'),
            fileTooLarge: t('fileDrop.fileTooLarge'),
            invalidServiceAccountJson: t('fileDrop.invalidServiceAccountJson'),
            invalidJson: t('fileDrop.invalidJson'),
            readFailed: t('fileDrop.readFailed'),
            invalidFileType: allowedExtensions =>
              t('fileDrop.invalidFileType', { extensions: allowedExtensions.join(', ') }),
            dropFile: t('fileDrop.dropJsonFile'),
          }}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
            handleServiceAccountChange(event.target.value);
          }}
          onFileRead={content => {
            handleServiceAccountChange(content);
          }}
          onFileReject={error => {
            toast.error(error);
          }}
        />
      )}

      <div className='mt-2'>
        <GoogleSheetsServiceAccountDescription />
      </div>
    </div>
  );
}
