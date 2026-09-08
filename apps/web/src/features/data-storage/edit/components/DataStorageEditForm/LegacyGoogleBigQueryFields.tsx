import { Button } from '@owox/ui/components/button';
import { FieldWithActions } from '@owox/ui/components/common/field-with-actions';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormSection,
} from '@owox/ui/components/form';
import { Input } from '@owox/ui/components/input';
import { Tabs, TabsList, TabsTrigger } from '@owox/ui/components/tabs';
import { FileDropTextarea } from '@owox/ui/components/file-drop-textarea';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { UseFormReturn } from 'react-hook-form';
import { Combobox } from '../../../../../shared/components/Combobox/combobox.tsx';
import { getServiceAccountLink } from '../../../../../utils/google-cloud-utils';
import { GoogleOAuthConnectButton, storageOAuthApi } from '../../../../../features/google-oauth';
import type { LegacyGoogleBigQueryFormData } from '../../../shared';
import { googleBigQueryLocationOptions, DataStorageType } from '../../../shared';
import GoogleBigQueryOAuthDescription from './FormDescriptions/GoogleBigQueryOAuthDescription';
import GoogleBigQueryServiceAccountDescription from './FormDescriptions/GoogleBigQueryServiceAccountDescription';
import LegacyGoogleBigQueryLocationDescription from './FormDescriptions/LegacyGoogleBigQueryLocationDescription.tsx';
import LegacyGoogleBigQueryProjectIdDescription from './FormDescriptions/LegacyGoogleBigQueryProjectIdDescription.tsx';
import { AuthenticationSectionHeader } from '../../../../../shared/components/AuthenticationSectionHeader';
import { CopyStorageCredentialsButton } from '../CopyStorageCredentialsButton';
import { useCopyCredentialContext } from '../../model/context/useCopyCredentialContext';

interface LegacyGoogleBigQueryFieldsProps {
  form: UseFormReturn<LegacyGoogleBigQueryFormData>;
}

const LEGACY_AUTODETECT_LOCATION = 'AUTODETECT';

export const LegacyGoogleBigQueryFields = ({ form }: LegacyGoogleBigQueryFieldsProps) => {
  const { t } = useTranslation();
  const legacyGoogleBigQueryLocationOptions = [
    {
      value: LEGACY_AUTODETECT_LOCATION,
      label: t('storageForm.legacyAutodetect'),
      group: t('storageForm.legacyCommonGroup'),
    },
    ...googleBigQueryLocationOptions,
  ];
  const {
    entityId: storageId,
    onSourceSelect: onSourceStorageSelect,
    selectedSource,
    onSourceClear,
  } = useCopyCredentialContext();
  const [isEditing, setIsEditing] = useState(false);
  const [isOAuthAvailable, setIsOAuthAvailable] = useState<boolean | null>(null);
  const [oauthRedirectUri, setOauthRedirectUri] = useState<string | undefined>(undefined);
  const [authMethod, setAuthMethod] = useState<'oauth' | 'service-account'>(() => {
    const sa = form.getValues('credentials.serviceAccount');
    return sa?.trim() ? 'service-account' : 'oauth';
  });
  const [stashedServiceAccount, setStashedServiceAccount] = useState<string | undefined>(undefined);
  const [stashedCredentialId, setStashedCredentialId] = useState<string | null | undefined>(
    undefined
  );

  useEffect(() => {
    storageOAuthApi
      .getSettings()
      .then(s => {
        setIsOAuthAvailable(s.available);
        setOauthRedirectUri(s.redirectUri);
        if (!s.available) {
          setAuthMethod('service-account');
        }
      })
      .catch(() => {
        setIsOAuthAvailable(false);
        setAuthMethod('service-account');
      });
  }, []);

  const handleOAuthSuccess = (credentialId: string) => {
    form.setValue('credentials.credentialId', credentialId, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue('credentials.serviceAccount', '');
  };

  const handleOAuthStatusChange = (isConnected: boolean, credentialId?: string) => {
    if (isConnected && credentialId) {
      setAuthMethod('oauth');
      form.setValue('credentials.credentialId', credentialId, {
        shouldDirty: false,
        shouldValidate: true,
      });
      form.setValue('credentials.serviceAccount', '');
    }
  };

  const handleAuthMethodChange = (value: 'oauth' | 'service-account') => {
    if (value === 'oauth') {
      setStashedServiceAccount(form.getValues('credentials.serviceAccount'));
      form.setValue('credentials.serviceAccount', '');
      if (stashedCredentialId) {
        form.setValue('credentials.credentialId', stashedCredentialId);
      }
    } else {
      setStashedCredentialId(form.getValues('credentials.credentialId'));
      form.setValue('credentials.credentialId', null);
      if (stashedServiceAccount) {
        form.setValue('credentials.serviceAccount', stashedServiceAccount);
      }
    }
    setAuthMethod(value);
  };

  const handleEdit = () => {
    setIsEditing(true);
    form.setValue('credentials.serviceAccount', '', {
      shouldDirty: true,
    });
  };

  const handleCancel = () => {
    setIsEditing(false);
    form.resetField('credentials.serviceAccount');
  };

  const serviceAccountValue = form.watch('credentials.serviceAccount');
  const serviceAccountLink = serviceAccountValue
    ? getServiceAccountLink(serviceAccountValue)
    : null;

  return (
    <>
      {/* Connection Settings */}
      <FormSection title={t('formCommon.connectionSettings')}>
        <FormField
          control={form.control}
          name='config.projectId'
          render={({ field }) => (
            <FormItem>
              <FormLabel tooltip={t('storageForm.legacyProjectTooltip')}>
                {t('storageForm.projectId')}
              </FormLabel>
              <FormControl>
                <Input {...field} disabled />
              </FormControl>
              <FormDescription>
                <LegacyGoogleBigQueryProjectIdDescription />
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='config.location'
          render={({ field }) => (
            <FormItem>
              <FormLabel tooltip={t('storageForm.legacyLocationTooltip')}>
                {t('storageForm.location')}
              </FormLabel>
              <FormControl>
                <Combobox
                  options={legacyGoogleBigQueryLocationOptions}
                  value={field.value}
                  onValueChange={field.onChange}
                  placeholder={t('storageForm.legacyLocationPlaceholder')}
                  emptyMessage={t('storageForm.legacyLocationEmpty')}
                  className='w-full'
                />
              </FormControl>
              <FormDescription>
                <LegacyGoogleBigQueryLocationDescription />
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </FormSection>

      {/* Authentication */}
      <div className='mb-4 flex flex-col gap-2'>
        <AuthenticationSectionHeader
          itemType='storage'
          copyButton={
            <CopyStorageCredentialsButton
              storageType={DataStorageType.LEGACY_GOOGLE_BIGQUERY}
              currentStorageId={storageId}
              onSelect={onSourceStorageSelect}
            />
          }
          selectedSource={selectedSource}
          onSourceClear={onSourceClear}
        />
        {!selectedSource && (
          <div className='flex flex-col gap-2'>
            {isOAuthAvailable && (
              <FormItem>
                <div className='flex items-center justify-between'>
                  <FormLabel>{t('storageForm.authMethod')}</FormLabel>
                  <Tabs
                    value={authMethod}
                    onValueChange={v => {
                      handleAuthMethodChange(v as 'oauth' | 'service-account');
                    }}
                  >
                    <TabsList>
                      <TabsTrigger value='oauth'>{t('storageForm.oauthMethod')}</TabsTrigger>
                      <TabsTrigger value='service-account'>
                        {t('storageForm.serviceAccountMethod')}
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </FormItem>
            )}

            {isOAuthAvailable && authMethod === 'oauth' && storageId && (
              <FormField
                control={form.control}
                name='credentials.credentialId'
                render={() => (
                  <FormItem>
                    <div className='mb-4 flex items-center justify-between'>
                      <FormLabel tooltip={t('storageForm.oauthTooltip')}>
                        {t('storageForm.oauthMethod')}
                      </FormLabel>
                    </div>
                    <GoogleOAuthConnectButton
                      resourceType='storage'
                      resourceId={storageId}
                      redirectUri={oauthRedirectUri}
                      onSuccess={handleOAuthSuccess}
                      onStatusChange={handleOAuthStatusChange}
                    />
                    <FormDescription>
                      <GoogleBigQueryOAuthDescription />
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {authMethod === 'service-account' && (
              <FormField
                control={form.control}
                name='credentials.serviceAccount'
                render={({ field }) => (
                  <FormItem>
                    <div className='flex items-center justify-between'>
                      <FormLabel tooltip={t('storageForm.serviceAccountTooltip')}>
                        {t('storageForm.serviceAccount')}
                      </FormLabel>
                      {!isEditing && serviceAccountValue && (
                        <Button variant='ghost' size='sm' onClick={handleEdit} type='button'>
                          {t('storageForm.edit')}
                        </Button>
                      )}
                      {isEditing && (
                        <Button variant='ghost' size='sm' onClick={handleCancel} type='button'>
                          {t('storageForm.cancelEdit')}
                        </Button>
                      )}
                    </div>
                    <FormControl>
                      {!isEditing && serviceAccountLink ? (
                        <FieldWithActions
                          value={serviceAccountLink.email}
                          actions={[
                            {
                              type: 'copy',
                              tooltip: t('storageForm.serviceAccountCopyEmail'),
                            },
                            {
                              type: 'external-link',
                              href: serviceAccountLink.url,
                              tooltip: t('storageForm.serviceAccountOpenDetails'),
                            },
                          ]}
                        />
                      ) : (
                        <FileDropTextarea
                          {...field}
                          className='min-h-[150px] font-mono'
                          rows={8}
                          placeholder={t('storageForm.serviceAccountPlaceholder')}
                          messages={{
                            multipleFiles: t('fileDrop.multipleFiles'),
                            fileTooLarge: t('fileDrop.fileTooLarge'),
                            invalidServiceAccountJson: t('fileDrop.invalidServiceAccountJson'),
                            invalidJson: t('fileDrop.invalidJson'),
                            readFailed: t('fileDrop.readFailed'),
                            invalidFileType: allowedExtensions =>
                              t('fileDrop.invalidFileType', {
                                extensions: allowedExtensions.join(', '),
                              }),
                            dropFile: t('fileDrop.dropJsonFile'),
                          }}
                          onFileRead={content => {
                            form.setValue('credentials.serviceAccount', content, {
                              shouldDirty: true,
                              shouldValidate: true,
                            });
                          }}
                          onFileReject={error => {
                            toast.error(error);
                          }}
                        />
                      )}
                    </FormControl>
                    <FormDescription>
                      <GoogleBigQueryServiceAccountDescription />
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>
        )}
      </div>
    </>
  );
};
