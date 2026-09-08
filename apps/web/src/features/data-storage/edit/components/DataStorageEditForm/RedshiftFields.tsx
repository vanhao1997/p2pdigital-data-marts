import { useEffect, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { Input } from '@owox/ui/components/input';
import { Tabs, TabsList, TabsTrigger } from '@owox/ui/components/tabs';
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormSection,
  FormDescription,
} from '@owox/ui/components/form';
import { DataStorageType, RedshiftConnectionType } from '../../../shared';
import type { DataStorageFormData } from '../../../shared/types/data-storage.schema.ts';
import RedshiftRegionDescription from './FormDescriptions/RedshiftRegionDescription.tsx';
import RedshiftWorkgroupDescription from './FormDescriptions/RedshiftWorkgroupDescription.tsx';
import RedshiftClusterDescription from './FormDescriptions/RedshiftClusterDescription.tsx';
import RedshiftDatabaseDescription from './FormDescriptions/RedshiftDatabaseDescription.tsx';
import RedshiftAccessKeyIdDescription from './FormDescriptions/RedshiftAccessKeyIdDescription.tsx';
import RedshiftSecretAccessKeyDescription from './FormDescriptions/RedshiftSecretAccessKeyDescription.tsx';
import { AuthenticationSectionHeader } from '../../../../../shared/components/AuthenticationSectionHeader';
import { CopyStorageCredentialsButton } from '../CopyStorageCredentialsButton';
import { useCopyCredentialContext } from '../../model/context/useCopyCredentialContext';
import { useTranslation } from 'react-i18next';

interface RedshiftFieldsProps {
  form: UseFormReturn<DataStorageFormData>;
}

export const RedshiftFields = ({ form }: RedshiftFieldsProps) => {
  const { t } = useTranslation();
  const {
    entityId: storageId,
    onSourceSelect: onSourceStorageSelect,
    selectedSource,
    onSourceClear,
  } = useCopyCredentialContext();
  const [maskedSecretValue, setMaskedSecretValue] = useState<string>('');

  // Set default connectionType if not set
  useEffect(() => {
    const currentType = form.getValues('config.connectionType') as
      | RedshiftConnectionType
      | undefined;
    const formType = form.watch('type');
    if (currentType === undefined && formType === DataStorageType.AWS_REDSHIFT) {
      form.setValue('config.connectionType', RedshiftConnectionType.SERVERLESS, {
        shouldDirty: false,
      });
    }
  }, [form]);

  useEffect(() => {
    const accessKeyId = form.getValues('credentials.accessKeyId');

    if (accessKeyId) {
      const maskedValue = '_'.repeat(accessKeyId.length);
      setMaskedSecretValue(maskedValue);
      form.setValue('credentials.secretAccessKey', maskedValue, { shouldDirty: false });
    }
  }, [form]);

  if (form.watch('type') !== DataStorageType.AWS_REDSHIFT) {
    return null;
  }

  return (
    <>
      {/* Connection Settings */}
      <FormSection title={t('formCommon.connectionSettings', 'Connection Settings')}>
        <FormField
          control={form.control}
          name='config.region'
          render={({ field }) => (
            <FormItem>
              <FormLabel
                tooltip={t(
                  'redshiftForm.regionTooltip',
                  'Enter the AWS region where your Redshift service is active'
                )}
              >
                {t('redshiftForm.region', 'Region')}
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder={t('redshiftForm.regionPlaceholder', 'Enter a region')}
                />
              </FormControl>
              <FormDescription>
                <RedshiftRegionDescription />
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {(() => {
          const connectionType =
            (form.watch('config.connectionType') as RedshiftConnectionType | undefined) ??
            RedshiftConnectionType.SERVERLESS;
          const tabs = (
            <Tabs
              value={connectionType}
              onValueChange={value => {
                form.setValue('config.connectionType', value as RedshiftConnectionType, {
                  shouldDirty: true,
                });
              }}
            >
              <TabsList>
                <TabsTrigger value={RedshiftConnectionType.SERVERLESS}>
                  {t('redshiftForm.serverless', 'Serverless')}
                </TabsTrigger>
                <TabsTrigger value={RedshiftConnectionType.PROVISIONED}>
                  {t('redshiftForm.provisioned', 'Provisioned')}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          );
          return connectionType === RedshiftConnectionType.SERVERLESS ? (
            <FormField
              control={form.control}
              name='config.workgroupName'
              render={({ field }) => (
                <FormItem>
                  <div className='flex items-center justify-between'>
                    <FormLabel
                      tooltip={t(
                        'redshiftForm.workgroupNameTooltip',
                        'Workgroup name for Redshift Serverless'
                      )}
                    >
                      {t('redshiftForm.workgroupName', 'Workgroup Name')}
                    </FormLabel>
                    {tabs}
                  </div>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t(
                        'redshiftForm.workgroupNamePlaceholder',
                        'Enter workgroup name'
                      )}
                    />
                  </FormControl>
                  <FormDescription>
                    <RedshiftWorkgroupDescription />
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : (
            <FormField
              control={form.control}
              name='config.clusterIdentifier'
              render={({ field }) => (
                <FormItem>
                  <div className='flex items-center justify-between'>
                    <FormLabel
                      tooltip={t(
                        'redshiftForm.clusterIdentifierTooltip',
                        'Cluster identifier for provisioned Redshift cluster'
                      )}
                    >
                      {t('redshiftForm.clusterIdentifier', 'Cluster Identifier')}
                    </FormLabel>
                    {tabs}
                  </div>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t(
                        'redshiftForm.clusterIdentifierPlaceholder',
                        'Enter cluster identifier'
                      )}
                    />
                  </FormControl>
                  <FormDescription>
                    <RedshiftClusterDescription />
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          );
        })()}

        <FormField
          control={form.control}
          name='config.database'
          render={({ field }) => (
            <FormItem>
              <FormLabel
                tooltip={t('redshiftForm.databaseTooltip', 'The database name to connect to')}
              >
                {t('redshiftForm.database', 'Database')}
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder={t('redshiftForm.databasePlaceholder', 'Enter database name')}
                />
              </FormControl>
              <FormDescription>
                <RedshiftDatabaseDescription />
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
              storageType={DataStorageType.AWS_REDSHIFT}
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
                  <FormLabel
                    tooltip={t(
                      'redshiftForm.accessKeyIdTooltip',
                      'Your AWS Access Key ID used for authentication'
                    )}
                  >
                    {t('redshiftForm.accessKeyId', 'Access Key ID')}
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t(
                        'redshiftForm.accessKeyIdPlaceholder',
                        'Enter an access key id'
                      )}
                    />
                  </FormControl>
                  <FormDescription>
                    <RedshiftAccessKeyIdDescription />
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
                  <FormLabel
                    tooltip={t(
                      'redshiftForm.secretAccessKeyTooltip',
                      'Your AWS Secret Access Key used for authentication'
                    )}
                  >
                    {t('redshiftForm.secretAccessKey', 'Secret Access Key')}
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type='password'
                      placeholder={
                        maskedSecretValue ||
                        t('redshiftForm.secretAccessKeyPlaceholder', 'Enter a secret access key')
                      }
                    />
                  </FormControl>
                  <FormDescription>
                    <RedshiftSecretAccessKeyDescription />
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
