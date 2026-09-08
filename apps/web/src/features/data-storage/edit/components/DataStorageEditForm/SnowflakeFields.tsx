import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@owox/ui/components/input';
import { Textarea } from '@owox/ui/components/textarea';
import { Tabs, TabsList, TabsTrigger } from '@owox/ui/components/tabs';
import { DataStorageType, SnowflakeAuthMethod } from '../../../shared';
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
import SnowflakeAccountDescription from './FormDescriptions/SnowflakeAccountDescription.tsx';
import SnowflakeWarehouseDescription from './FormDescriptions/SnowflakeWarehouseDescription.tsx';
import SnowflakeAuthMethodDescription from './FormDescriptions/SnowflakeAuthMethodDescription.tsx';
import SnowflakeUsernameDescription from './FormDescriptions/SnowflakeUsernameDescription.tsx';
import SnowflakePasswordDescription from './FormDescriptions/SnowflakePasswordDescription.tsx';
import SnowflakeKeyPairDescription from './FormDescriptions/SnowflakeKeyPairDescription.tsx';
import SnowflakePassphraseDescription from './FormDescriptions/SnowflakePassphraseDescription.tsx';
import { AuthenticationSectionHeader } from '../../../../../shared/components/AuthenticationSectionHeader';
import { CopyStorageCredentialsButton } from '../CopyStorageCredentialsButton';
import { useCopyCredentialContext } from '../../model/context/useCopyCredentialContext';

interface SnowflakeFieldsProps {
  form: UseFormReturn<DataStorageFormData>;
}

export const SnowflakeFields = ({ form }: SnowflakeFieldsProps) => {
  const { t } = useTranslation();
  const {
    entityId: storageId,
    onSourceSelect: onSourceStorageSelect,
    selectedSource,
    onSourceClear,
  } = useCopyCredentialContext();
  const authMethod = form.watch('credentials.authMethod');
  const [maskedPasswordValue, setMaskedPasswordValue] = useState<string>('');
  const [maskedPrivateKeyValue, setMaskedPrivateKeyValue] = useState<string>('');

  useEffect(() => {
    const username = form.getValues('credentials.username');

    if (username) {
      const maskedPassword = '_'.repeat(12);
      setMaskedPasswordValue(maskedPassword);
      form.setValue('credentials.password', maskedPassword, { shouldDirty: false });

      const maskedKey = '_'.repeat(20);
      setMaskedPrivateKeyValue(maskedKey);
      form.setValue('credentials.privateKey', maskedKey, { shouldDirty: false });
    }
  }, [form]);

  if (form.watch('type') !== DataStorageType.SNOWFLAKE) {
    return null;
  }

  return (
    <>
      {/* Connection Settings */}
      <FormSection title={t('formCommon.connectionSettings')}>
        <FormField
          control={form.control}
          name='config.account'
          render={({ field }) => (
            <FormItem>
              <FormLabel tooltip={t('storageForm.accountTooltip')}>
                {t('storageForm.accountLabel')}
              </FormLabel>
              <FormControl>
                <Input {...field} placeholder={t('storageForm.accountPlaceholder')} />
              </FormControl>
              <FormDescription>
                <SnowflakeAccountDescription />
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='config.warehouse'
          render={({ field }) => (
            <FormItem>
              <FormLabel tooltip={t('storageForm.warehouseTooltip')}>
                {t('storageForm.warehouseLabel')}
              </FormLabel>
              <FormControl>
                <Input {...field} placeholder={t('storageForm.warehousePlaceholder')} />
              </FormControl>
              <FormDescription>
                <SnowflakeWarehouseDescription />
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
              storageType={DataStorageType.SNOWFLAKE}
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
              name='credentials.authMethod'
              render={({ field }) => (
                <FormItem>
                  <div className='flex items-center justify-between'>
                    <FormLabel>{t('storageForm.authMethod')}</FormLabel>
                    <Tabs value={field.value} onValueChange={field.onChange}>
                      <TabsList>
                        <TabsTrigger value={SnowflakeAuthMethod.PASSWORD}>
                          {t('storageForm.usernameAndPat')}
                        </TabsTrigger>
                        <TabsTrigger value={SnowflakeAuthMethod.KEY_PAIR}>
                          {t('storageForm.keyPair')}
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                  <FormDescription>
                    <SnowflakeAuthMethodDescription />
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='credentials.username'
              render={({ field }) => (
                <FormItem>
                  <FormLabel tooltip={t('storageForm.usernameTooltip')}>
                    {t('storageForm.username')}
                  </FormLabel>
                  <FormControl>
                    <Input {...field} placeholder={t('storageForm.usernamePlaceholder')} />
                  </FormControl>
                  <FormDescription>
                    <SnowflakeUsernameDescription />
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {authMethod === SnowflakeAuthMethod.PASSWORD && (
              <FormField
                control={form.control}
                name='credentials.password'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel tooltip={t('storageForm.patTooltip')}>
                      {t('storageForm.pat')}
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type='password'
                        placeholder={maskedPasswordValue || t('storageForm.patPlaceholder')}
                      />
                    </FormControl>
                    <FormDescription>
                      <SnowflakePasswordDescription />
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {authMethod === SnowflakeAuthMethod.KEY_PAIR && (
              <>
                <FormField
                  control={form.control}
                  name='credentials.privateKey'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel tooltip={t('storageForm.privateKeyTooltip')}>
                        {t('storageForm.privateKey')}
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder={
                            maskedPrivateKeyValue || t('storageForm.privateKeyPlaceholder')
                          }
                          rows={6}
                        />
                      </FormControl>
                      <FormDescription>
                        <SnowflakeKeyPairDescription />
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='credentials.privateKeyPassphrase'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel tooltip={t('storageForm.passphraseTooltip')}>
                        {t('storageForm.passphrase')}
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type='password'
                          value={field.value ?? ''}
                          placeholder={t('storageForm.passphrasePlaceholder')}
                        />
                      </FormControl>
                      <FormDescription>
                        <SnowflakePassphraseDescription />
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
};
