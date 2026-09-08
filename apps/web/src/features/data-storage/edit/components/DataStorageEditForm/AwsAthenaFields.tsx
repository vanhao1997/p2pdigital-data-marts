import { Input } from '@owox/ui/components/input';
import { DataStorageType } from '../../../shared';
import type { DataStorageFormData } from '../../../shared/types/data-storage.schema.ts';
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormSection,
  FormDescription,
} from '@owox/ui/components/form';
import type { UseFormReturn } from 'react-hook-form';
import AthenaRegionDescription from './FormDescriptions/AthenaRegionDescription.tsx';
import AthenaOutputBucketDescription from './FormDescriptions/AthenaOutputBucketDescription.tsx';
import AthenaAccessKeyIdDescription from './FormDescriptions/AthenaAccessKeyIdDescription.tsx';
import AthenaSecretAccessKeyDescription from './FormDescriptions/AthenaSecretAccessKeyDescription.tsx';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthenticationSectionHeader } from '../../../../../shared/components/AuthenticationSectionHeader';
import { CopyStorageCredentialsButton } from '../CopyStorageCredentialsButton';
import { useCopyCredentialContext } from '../../model/context/useCopyCredentialContext';

interface AwsAthenaFieldsProps {
  form: UseFormReturn<DataStorageFormData>;
}

export const AwsAthenaFields = ({ form }: AwsAthenaFieldsProps) => {
  const { t } = useTranslation();
  const {
    entityId: storageId,
    onSourceSelect: onSourceStorageSelect,
    selectedSource,
    onSourceClear,
  } = useCopyCredentialContext();
  const [maskedSecretValue, setMaskedSecretValue] = useState<string>('');

  useEffect(() => {
    const accessKeyId = form.getValues('credentials.accessKeyId');

    if (accessKeyId) {
      const maskedValue = '_'.repeat(accessKeyId.length);
      setMaskedSecretValue(maskedValue);
      form.setValue('credentials.secretAccessKey', maskedValue, { shouldDirty: false });
    }
  }, [form]);

  if (form.watch('type') !== DataStorageType.AWS_ATHENA) {
    return null;
  }
  return (
    <>
      {/* Connection Settings */}
      <FormSection title={t('formCommon.connectionSettings')}>
        <FormField
          control={form.control}
          name='config.region'
          render={({ field }) => (
            <FormItem>
              <FormLabel tooltip={t('storageForm.awsRegionTooltip')}>
                {t('storageForm.awsRegion')}
              </FormLabel>
              <FormControl>
                <Input {...field} placeholder={t('storageForm.awsRegionPlaceholder')} />
              </FormControl>
              <FormDescription>
                <AthenaRegionDescription />
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='config.outputBucket'
          render={({ field }) => (
            <FormItem>
              <FormLabel tooltip={t('storageForm.outputBucketTooltip')}>
                {t('storageForm.outputBucket')}
              </FormLabel>
              <FormControl>
                <Input {...field} placeholder={t('storageForm.outputBucketPlaceholder')} />
              </FormControl>
              <FormDescription>
                <AthenaOutputBucketDescription />
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
              storageType={DataStorageType.AWS_ATHENA}
              currentStorageId={storageId}
              onSelect={onSourceStorageSelect}
            />
          }
          selectedSource={selectedSource}
          onSourceClear={onSourceClear}
        />
        {!selectedSource && (
          <div className='flex flex-col gap-2'>
            <FormField
              control={form.control}
              name='credentials.accessKeyId'
              render={({ field }) => (
                <FormItem>
                  <FormLabel tooltip={t('storageForm.accessKeyIdTooltip')}>
                    {t('storageForm.accessKeyId')}
                  </FormLabel>
                  <FormControl>
                    <Input {...field} placeholder={t('storageForm.accessKeyIdPlaceholder')} />
                  </FormControl>
                  <FormDescription>
                    <AthenaAccessKeyIdDescription />
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='credentials.secretAccessKey'
              render={({ field }) => (
                <FormItem>
                  <FormLabel tooltip={t('storageForm.secretAccessKeyTooltip')}>
                    {t('storageForm.secretAccessKey')}
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type='password'
                      placeholder={maskedSecretValue || t('storageForm.secretAccessKeyPlaceholder')}
                    />
                  </FormControl>
                  <FormDescription>
                    <AthenaSecretAccessKeyDescription />
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}
      </div>
    </>
  );
};
