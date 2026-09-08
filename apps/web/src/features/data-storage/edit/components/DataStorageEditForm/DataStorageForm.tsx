import { Button } from '@owox/ui/components/button';
import {
  AppForm,
  Form,
  FormActions,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormLayout,
  FormMessage,
  FormSection,
} from '@owox/ui/components/form';
import { Input } from '@owox/ui/components/input';
import { Switch } from '@owox/ui/components/switch';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@owox/ui/components/select';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import type { CredentialIdentity } from '../../../../../shared/types/credential-identity';
import { OwnersSection } from '../../../../../shared/components/OwnersSection/OwnersSection';
import { ContextPicker } from '../../../../../features/contexts/components/ContextPicker/ContextPicker';
import { AddContextSheet } from '../../../../../features/contexts/components/AddContextSheet/AddContextSheet';
import { useInlineContextCreate } from '../../../../../features/contexts/hooks/useInlineContextCreate';
import type { UserProjectionDto } from '../../../../../shared/types/api';
import { useOwnerState } from '../../../../../shared/hooks/useOwnerState';
import { useUser } from '../../../../idp/hooks/useAuthState';
import { useIsAdmin } from '../../../../idp/hooks/useRole';
import type { UserProjection } from '../../../../../shared/types';
import { UserReference } from '../../../../../shared/components/UserReference/UserReference';
import { CopyCredentialContext } from '../../model/context/copy-credential-context';
import { createDataStorageFormResolver } from '../../model/data-storage-form-resolver';
import { createFormPayload, focusFirstInvalidField } from '../../../../../utils/form-utils';
import {
  type DataStorageFormData,
  type GoogleBigQueryFormData,
  type LegacyGoogleBigQueryFormData,
  DataStorageHealthIndicator,
  DataStorageStatus,
  DataStorageType,
} from '../../../shared';
import type { UseFormReturn } from 'react-hook-form';
import { DataStorageTypeModel } from '../../../shared/types/data-storage-type.model.ts';
import { AwsAthenaFields } from './AwsAthenaFields';
import { DatabricksFields } from './DatabricksFields';
import LegacyGoogleBigQueryTitleDescription from './FormDescriptions/LegacyGoogleBigQueryTitleDescription.tsx';
import StorageTypeAthenaDescription from './FormDescriptions/StorageTypeAthenaDescription.tsx';
import StorageTypeBigQueryDescription from './FormDescriptions/StorageTypeBigQueryDescription.tsx';
import StorageTypeDatabricksDescription from './FormDescriptions/StorageTypeDatabricksDescription.tsx';
import StorageTypeLegacyBigQueryDescription from './FormDescriptions/StorageTypeLegacyBigQueryDescription.tsx';
import StorageTypeRedshiftDescription from './FormDescriptions/StorageTypeRedshiftDescription.tsx';
import StorageTypeSnowflakeDescription from './FormDescriptions/StorageTypeSnowflakeDescription.tsx';
import { GoogleBigQueryFields } from './GoogleBigQueryFields';
import { LegacyGoogleBigQueryFields } from './LegacyGoogleBigQueryFields';
import { RedshiftFields } from './RedshiftFields';
import { SnowflakeFields } from './SnowflakeFields';

interface DataStorageFormProps {
  initialData?: DataStorageFormData & {
    id?: string;
    ownerUsers?: UserProjection[];
    createdAt?: Date;
    createdByUser?: UserProjection | null;
    contexts?: { id: string; name: string }[];
  };
  onSubmit: (
    data: DataStorageFormData,
    source?: { id: string; title: string } | null
  ) => Promise<void>;
  onCancel: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

export function DataStorageForm({
  initialData,
  onSubmit,
  onCancel,
  onDirtyChange,
}: DataStorageFormProps) {
  const { t } = useTranslation();
  // The resolver reads this ref so credential validation is bypassed while
  // the user copies credentials from another storage (fields are hidden then).
  const copySourceSelectedRef = useRef(false);
  const resolver = useMemo(
    () => createDataStorageFormResolver(() => copySourceSelectedRef.current),
    []
  );
  const form = useForm<DataStorageFormData>({
    resolver,
    defaultValues: initialData,
  });

  const currentUser = useUser();
  const initialOwnerUsers =
    (initialData?.ownerUsers as UserProjectionDto[] | undefined) ??
    (currentUser
      ? [
          {
            userId: currentUser.id,
            fullName: currentUser.fullName ?? null,
            email: currentUser.email ?? null,
            avatar: currentUser.avatar ?? null,
          },
        ]
      : []);
  const { ownerUsers, ownersDirty, handleOwnersChange, consumePendingOwnerIds } =
    useOwnerState(initialOwnerUsers);

  const sharingInitial = initialData as
    | { availableForUse?: boolean; availableForMaintenance?: boolean }
    | undefined;
  const [sharingState, setSharingState] = useState({
    availableForUse: sharingInitial?.availableForUse ?? true,
    availableForMaintenance: sharingInitial?.availableForMaintenance ?? true,
  });

  const sharingDirty =
    sharingState.availableForUse !== (sharingInitial?.availableForUse ?? true) ||
    sharingState.availableForMaintenance !== (sharingInitial?.availableForMaintenance ?? true);

  const initialContextIds = (initialData?.contexts ?? []).map(c => c.id);
  const [contextIds, setContextIds] = useState<string[]>(initialContextIds);
  const contextsDirty =
    contextIds.length !== initialContextIds.length ||
    contextIds.some(id => !initialContextIds.includes(id));

  const isAdmin = useIsAdmin();
  const inlineContext = useInlineContextCreate({
    enabled: isAdmin,
    onCreated: created => {
      setContextIds(prev => (prev.includes(created.id) ? prev : [...prev, created.id]));
    },
  });

  const [selectedSource, setSelectedSource] = useState<{
    id: string;
    title: string;
    identity: CredentialIdentity | null;
  } | null>(null);

  const handleSourceSelect = useCallback(
    (id: string, title: string, identity: CredentialIdentity | null) => {
      setSelectedSource({ id, title, identity });
      copySourceSelectedRef.current = true;
      // Credentials now come from the source storage; drop stale field errors
      form.clearErrors('credentials');
    },
    [form]
  );

  const handleSourceClear = useCallback(() => {
    setSelectedSource(null);
    copySourceSelectedRef.current = false;
  }, []);

  const {
    watch,
    control,
    formState: { isDirty, isSubmitting },
  } = form;
  const selectedType = watch('type');
  const storageId = initialData?.id;

  useEffect(() => {
    onDirtyChange?.(
      isDirty || selectedSource !== null || ownersDirty || sharingDirty || contextsDirty
    );
  }, [isDirty, selectedSource, ownersDirty, sharingDirty, contextsDirty, onDirtyChange]);

  const copyCredentialCtx = useMemo(
    () => ({
      entityId: storageId,
      onSourceSelect: handleSourceSelect,
      selectedSource,
      onSourceClear: handleSourceClear,
    }),
    [storageId, selectedSource, handleSourceSelect, handleSourceClear]
  );

  const handleSubmit = async (data: DataStorageFormData) => {
    const { dirtyFields } = form.formState;
    const payload = createFormPayload(data);

    // Strip credentials when copying from another source (server handles it via sourceStorageId)
    // or when no credential fields were touched by the user.
    if (!dirtyFields.credentials || selectedSource) {
      delete (payload as Partial<DataStorageFormData>).credentials;
    }

    const ownerIds = consumePendingOwnerIds();
    if (ownerIds !== null) {
      (payload as Record<string, unknown>).ownerIds = ownerIds;
    }

    if (sharingDirty) {
      (payload as Record<string, unknown>).availableForUse = sharingState.availableForUse;
      (payload as Record<string, unknown>).availableForMaintenance =
        sharingState.availableForMaintenance;
    }

    if (contextsDirty) {
      (payload as Record<string, unknown>).contextIds = contextIds;
    }

    await onSubmit(payload, selectedSource);
  };

  const isLegacyGoogleBigQuery = selectedType === DataStorageType.LEGACY_GOOGLE_BIGQUERY;

  return (
    <Form {...form}>
      <AppForm
        data-testid='storageEditForm'
        onSubmit={e => {
          void form.handleSubmit(handleSubmit, focusFirstInvalidField)(e);
        }}
        noValidate
      >
        <FormLayout>
          <FormSection
            title={t('formCommon.general', 'General')}
            defaultOpen={!isLegacyGoogleBigQuery}
            fields={['title', 'type']}
          >
            {storageId && (
              <FormItem>
                <DataStorageHealthIndicator storageId={storageId} />
              </FormItem>
            )}
            <FormField
              control={control}
              name='title'
              render={({ field }) => (
                <FormItem>
                  <FormLabel
                    tooltip={t(
                      'formCommon.titleTooltipStorage',
                      'Name the storage to clarify its purpose'
                    )}
                  >
                    {t('common.title', 'Title')}
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t('formCommon.storageTitlePlaceholder', 'Storage title')}
                      disabled={isLegacyGoogleBigQuery}
                    />
                  </FormControl>
                  {isLegacyGoogleBigQuery && (
                    <FormDescription>
                      <LegacyGoogleBigQueryTitleDescription />
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name='type'
              render={({ field }) => (
                <FormItem>
                  <FormLabel tooltip={t('storageForm.storageTypeTooltip')}>
                    {t('formCommon.storageType', 'Storage Type')}
                  </FormLabel>
                  <FormControl>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={!!initialData}
                    >
                      <SelectTrigger className='w-full'>
                        <SelectValue
                          placeholder={t('formCommon.selectStorageType', 'Select a storage type')}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {DataStorageTypeModel.getAllTypes().map(
                            ({ type, displayName, icon: Icon, status }) => (
                              <SelectItem
                                key={type}
                                value={type}
                                disabled={status === DataStorageStatus.COMING_SOON}
                              >
                                <div className='flex items-center gap-2'>
                                  <Icon size={20} />
                                  {displayName}
                                </div>
                              </SelectItem>
                            )
                          )}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormDescription>
                    {selectedType === DataStorageType.GOOGLE_BIGQUERY && (
                      <StorageTypeBigQueryDescription />
                    )}
                    {selectedType === DataStorageType.LEGACY_GOOGLE_BIGQUERY && (
                      <StorageTypeLegacyBigQueryDescription />
                    )}
                    {selectedType === DataStorageType.AWS_ATHENA && (
                      <StorageTypeAthenaDescription />
                    )}
                    {selectedType === DataStorageType.SNOWFLAKE && (
                      <StorageTypeSnowflakeDescription />
                    )}
                    {selectedType === DataStorageType.AWS_REDSHIFT && (
                      <StorageTypeRedshiftDescription />
                    )}
                    {selectedType === DataStorageType.DATABRICKS && (
                      <StorageTypeDatabricksDescription />
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </FormSection>
          <CopyCredentialContext.Provider value={copyCredentialCtx}>
            {selectedType === DataStorageType.GOOGLE_BIGQUERY && (
              <GoogleBigQueryFields form={form as UseFormReturn<GoogleBigQueryFormData>} />
            )}
            {selectedType === DataStorageType.LEGACY_GOOGLE_BIGQUERY && (
              <LegacyGoogleBigQueryFields
                form={form as UseFormReturn<LegacyGoogleBigQueryFormData>}
              />
            )}
            {selectedType === DataStorageType.AWS_ATHENA && <AwsAthenaFields form={form} />}
            {selectedType === DataStorageType.SNOWFLAKE && <SnowflakeFields form={form} />}
            {selectedType === DataStorageType.AWS_REDSHIFT && <RedshiftFields form={form} />}
            {selectedType === DataStorageType.DATABRICKS && <DatabricksFields form={form} />}
          </CopyCredentialContext.Provider>

          <FormSection
            title={t('formCommon.ownership', 'Ownership')}
            defaultOpen={false}
            name='storage-ownership'
          >
            <FormItem>
              <FormLabel tooltip={t('storageForm.ownersTooltip')}>
                {t('formCommon.owners', 'Owners')}
              </FormLabel>
              <OwnersSection ownerUsers={ownerUsers} onSave={handleOwnersChange} />
              <FormDescription>
                <Accordion variant='common' type='single' collapsible>
                  <AccordionItem value='storage-owners-help'>
                    <AccordionTrigger>{t('storageForm.ownersQuestion')}</AccordionTrigger>
                    <AccordionContent>
                      <p>{t('storageForm.ownersDescription')}</p>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </FormDescription>
            </FormItem>
          </FormSection>

          {storageId && (
            <FormSection
              title={t('formCommon.contexts', 'Contexts')}
              defaultOpen={false}
              name='storage-contexts'
            >
              <FormItem>
                <FormLabel tooltip={t('storageForm.storageContextsTooltip')}>
                  {t('formCommon.assigned', 'Assigned')}
                </FormLabel>
                <ContextPicker
                  selectedContextIds={contextIds}
                  onChange={setContextIds}
                  idPrefix='storage-ctx'
                  {...inlineContext.pickerProps}
                />
                <FormDescription>
                  <Accordion variant='common' type='single' collapsible>
                    <AccordionItem value='storage-contexts-help'>
                      <AccordionTrigger>
                        {t('storageForm.storageContextsQuestion')}
                      </AccordionTrigger>
                      <AccordionContent>
                        <p>{t('storageForm.storageContextsDescription')}</p>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </FormDescription>
              </FormItem>
            </FormSection>
          )}

          {initialData?.id && (
            <FormSection
              title={t('formCommon.sharing', 'Sharing')}
              defaultOpen={false}
              name='storage-availability'
            >
              <FormItem>
                <div className='flex items-center justify-between gap-4'>
                  <FormLabel>{t('formCommon.sharedForUse', 'Shared for use')}</FormLabel>
                  <Switch
                    checked={sharingState.availableForUse}
                    onCheckedChange={v => {
                      setSharingState(prev => ({ ...prev, availableForUse: v }));
                    }}
                  />
                </div>
                <p className='text-muted-foreground text-sm'>
                  {t('storageForm.sharedForUseDescription')}
                </p>
                <FormDescription>
                  <Accordion variant='common' type='single' collapsible>
                    <AccordionItem value='sharing-use-help'>
                      <AccordionTrigger>{t('storageForm.sharedForUseQuestion')}</AccordionTrigger>
                      <AccordionContent>
                        <p>{t('storageForm.sharedForUseHelp')}</p>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </FormDescription>
              </FormItem>
              <FormItem>
                <div className='flex items-center justify-between gap-4'>
                  <FormLabel>
                    {t('formCommon.sharedForMaintenance', 'Shared for maintenance')}
                  </FormLabel>
                  <Switch
                    checked={sharingState.availableForMaintenance}
                    onCheckedChange={v => {
                      setSharingState(prev => ({ ...prev, availableForMaintenance: v }));
                    }}
                  />
                </div>
                <p className='text-muted-foreground text-sm'>
                  {t('storageForm.sharedForMaintenanceDescription')}
                </p>
                <FormDescription>
                  <Accordion variant='common' type='single' collapsible>
                    <AccordionItem value='sharing-maintenance-help'>
                      <AccordionTrigger>
                        {t('storageForm.sharedForMaintenanceQuestion')}
                      </AccordionTrigger>
                      <AccordionContent>
                        <p>{t('storageForm.sharedForMaintenanceHelp')}</p>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </FormDescription>
              </FormItem>
            </FormSection>
          )}

          {initialData?.createdAt && (
            <FormSection
              title={t('formCommon.details', 'Details')}
              defaultOpen={false}
              name='storage-details'
            >
              <FormItem>
                <FormLabel>{t('formCommon.createdBy', 'Created By')}</FormLabel>
                <div className='text-sm'>
                  {initialData.createdByUser ? (
                    <UserReference userProjection={initialData.createdByUser} variant='full' />
                  ) : (
                    <span className='text-muted-foreground'>
                      {t('formCommon.unknown', 'Unknown')}
                    </span>
                  )}
                </div>
              </FormItem>
              <FormItem>
                <FormLabel>{t('formCommon.createdAt', 'Created At')}</FormLabel>
                <div className='text-muted-foreground text-sm'>
                  {new Date(initialData.createdAt).toLocaleDateString('vi-VN', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </div>
              </FormItem>
            </FormSection>
          )}
        </FormLayout>
        <FormActions>
          <Button
            variant='default'
            type='submit'
            className='w-full'
            aria-label={t('formCommon.save', 'Save')}
            disabled={
              (!isDirty && !selectedSource && !ownersDirty && !sharingDirty && !contextsDirty) ||
              isSubmitting
            }
          >
            {t('formCommon.save', 'Save')}
          </Button>
          <Button
            variant='outline'
            type='button'
            onClick={onCancel}
            className='w-full'
            aria-label={t('formCommon.cancel', 'Cancel')}
          >
            {t('formCommon.cancel', 'Cancel')}
          </Button>
        </FormActions>
      </AppForm>
      {/*
       * Sheet-in-sheet: nested Radix Dialogs stack via portals, so the outer
       * Storage sheet stays mounted beneath and its unsaved form state is
       * preserved while the admin creates a new context. The hook bumps
       * the picker refresh token and closes the sheet; we just push the
       * new id into `contextIds`.
       */}
      <AddContextSheet {...inlineContext.sheetProps} />
    </Form>
  );
}
