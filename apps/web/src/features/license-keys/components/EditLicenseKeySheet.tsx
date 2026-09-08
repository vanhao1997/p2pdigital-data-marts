import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@owox/ui/components/sheet';
import {
  AppForm,
  Form,
  FormActions,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormLayout,
  FormMessage,
  FormSection,
} from '@owox/ui/components/form';
import { Input } from '@owox/ui/components/input';
import { Button } from '@owox/ui/components/button';
import { Copy, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { licenseKeysService } from '../services/license-keys.service';
import { formatDateShort } from '../../../utils';
import type { LicenseKey } from '../types';
import { ExpirationValue } from '../../../shared/components/ExpirationValue/ExpirationValue';

const editLicenseKeySchema = (t: (key: string) => string) =>
  z.object({
    name: z
      .string()
      .min(1, t('licenseKeysPage.validation.nameRequired'))
      .max(255, t('licenseKeysPage.validation.nameTooLong')),
  });

type EditLicenseKeyFormValues = z.infer<ReturnType<typeof editLicenseKeySchema>>;

interface EditLicenseKeySheetProps {
  licenseKey: LicenseKey | null;
  onClose: () => void;
  onUpdated: () => void;
  onRevoke: (key: LicenseKey) => void;
}

function MetadataItem({
  label,
  value,
  description,
}: {
  label: string;
  value: ReactNode;
  description: string;
}) {
  return (
    <FormItem>
      <FormLabel tooltip={description}>{label}</FormLabel>
      <span className='text-muted-foreground text-sm'>{value}</span>
    </FormItem>
  );
}

function CopyableItem({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  const { t } = useTranslation();

  return (
    <FormItem>
      <FormLabel tooltip={description}>{label}</FormLabel>
      <div className='bg-muted flex items-center justify-between gap-2 rounded-md px-3 py-2'>
        <code className='truncate text-sm'>{value}</code>
        <Button
          type='button'
          variant='ghost'
          size='icon'
          className='size-7 shrink-0'
          aria-label={t('licenseKeysPage.table.copyValue', { label })}
          onClick={() => {
            void navigator.clipboard
              .writeText(value)
              .then(() => toast.success(t('licenseKeysPage.table.valueCopied', { label })))
              .catch(() => toast.error(t('licenseKeysPage.table.copyValueFailed', { label })));
          }}
        >
          <Copy className='size-3.5' />
        </Button>
      </div>
    </FormItem>
  );
}

export function EditLicenseKeySheet({
  licenseKey,
  onClose,
  onUpdated,
  onRevoke,
}: EditLicenseKeySheetProps) {
  const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const schema = useMemo(() => editLicenseKeySchema(t), [t]);

  const form = useForm<EditLicenseKeyFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '' },
    mode: 'onChange',
  });

  const { control, handleSubmit, reset } = form;

  useEffect(() => {
    if (licenseKey) {
      reset({ name: licenseKey.name });
    }
  }, [licenseKey, reset]);

  const onSubmit = async (values: EditLicenseKeyFormValues) => {
    if (!licenseKey) return;
    setSubmitting(true);
    try {
      await licenseKeysService.updateKey(licenseKey.licenseKeyId, { name: values.name });
      toast.success(t('licenseKeysPage.nameUpdated'));
      onUpdated();
    } catch {
      toast.error(t('licenseKeysPage.nameUpdateFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet
      open={!!licenseKey}
      onOpenChange={open => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        onOpenAutoFocus={e => {
          e.preventDefault();
          titleRef.current?.focus({ preventScroll: true });
        }}
      >
        <SheetHeader>
          <SheetTitle ref={titleRef} tabIndex={-1} className='focus:outline-none'>
            {t('licenseKeysPage.editTitle')}
          </SheetTitle>
          <SheetDescription>{t('licenseKeysPage.editDescription')}</SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <AppForm onSubmit={e => void handleSubmit(onSubmit)(e)}>
            <FormLayout>
              <FormSection title={t('common.general')} name='license-key-general'>
                <FormField
                  control={control}
                  name='name'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel tooltip={t('licenseKeysPage.nameTooltip')}>
                        {t('common.name')}
                      </FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <CopyableItem
                  label={t('licenseKeysPage.table.licenseKeyId')}
                  value={licenseKey?.licenseKeyId ?? ''}
                  description={t('licenseKeysPage.table.licenseKeyIdTooltip')}
                />
                <CopyableItem
                  label={t('licenseKeysPage.table.origin')}
                  value={licenseKey?.origin ?? ''}
                  description={t('licenseKeysPage.table.originTooltip')}
                />
                <MetadataItem
                  label={t('licenseKeysPage.table.expires')}
                  value={
                    licenseKey ? (
                      <ExpirationValue
                        expiresAt={licenseKey.expiresAt}
                        expiredNotice={t('licenseKeysPage.expiredNotice')}
                        expiringSoonNotice={t('licenseKeysPage.expiringSoonNotice')}
                        focusable
                      />
                    ) : (
                      t('common.unknown')
                    )
                  }
                  description={t('licenseKeysPage.table.expiresTooltip')}
                />
                <MetadataItem
                  label={t('licenseKeysPage.table.created')}
                  value={licenseKey ? formatDateShort(licenseKey.createdAt) : t('common.unknown')}
                  description={t('licenseKeysPage.table.createdTooltip')}
                />
                <MetadataItem
                  label={t('licenseKeysPage.table.lastActivity')}
                  value={
                    licenseKey?.lastUsedAt
                      ? formatDateShort(licenseKey.lastUsedAt)
                      : t('licenseKeysPage.table.never')
                  }
                  description={t('licenseKeysPage.table.lastActivityTooltip')}
                />
              </FormSection>

              <FormSection title={t('licenseKeysPage.credentials')} name='license-key-credentials'>
                <FormItem>
                  <FormLabel tooltip={t('licenseKeysPage.keyTooltip')}>
                    {t('licenseKeysPage.keyLabel')}
                  </FormLabel>
                  <p className='text-muted-foreground text-sm'>
                    {t('licenseKeysPage.unavailableNotice')}
                  </p>
                </FormItem>
              </FormSection>

              <FormSection
                title={t('licenseKeysPage.dangerZone')}
                name='license-key-danger-zone'
                defaultOpen={false}
              >
                <FormItem>
                  <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                    <div className='space-y-1'>
                      <p className='text-sm font-medium'>{t('licenseKeysPage.revokeTitle')}</p>
                      <p className='text-muted-foreground text-sm'>
                        {t('licenseKeysPage.revokeDescription')}
                      </p>
                    </div>
                    <Button
                      type='button'
                      variant='outline'
                      className='border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/15 sm:shrink-0'
                      disabled={!licenseKey || submitting}
                      onClick={() => {
                        if (licenseKey) onRevoke(licenseKey);
                      }}
                    >
                      <Trash2 className='size-4' />
                      {t('licenseKeysPage.revokeButton')}
                    </Button>
                  </div>
                </FormItem>
              </FormSection>
            </FormLayout>

            <FormActions>
              <Button type='button' variant='secondary' onClick={onClose}>
                {t('common.cancel')}
              </Button>
              <Button type='submit' disabled={submitting}>
                {submitting ? <Loader2 className='mr-2 size-4 animate-spin' /> : null}
                {t('common.save')}
              </Button>
            </FormActions>
          </AppForm>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
