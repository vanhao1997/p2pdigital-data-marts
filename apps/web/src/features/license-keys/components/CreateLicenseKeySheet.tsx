import { useMemo, useState } from 'react';
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormLayout,
  FormMessage,
  FormSection,
} from '@owox/ui/components/form';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { Input } from '@owox/ui/components/input';
import { Button } from '@owox/ui/components/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { licenseKeysService } from '../services/license-keys.service';
import type { CreateLicenseKeyResponse } from '../types';

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname);
  } catch {
    return false;
  }
}

const createLicenseKeySchema = (t: (key: string) => string) =>
  z.object({
    name: z
      .string()
      .min(1, t('licenseKeysPage.validation.nameRequired'))
      .max(255, t('licenseKeysPage.validation.nameTooLong')),
    origin: z
      .string()
      .min(1, t('licenseKeysPage.validation.originRequired'))
      .max(255, t('licenseKeysPage.validation.originTooLong'))
      .refine(isHttpUrl, {
        message: t('licenseKeysPage.validation.originInvalid'),
      }),
  });

type CreateLicenseKeyFormValues = z.infer<ReturnType<typeof createLicenseKeySchema>>;

const DEFAULT_VALUES: CreateLicenseKeyFormValues = { name: '', origin: '' };

interface CreateLicenseKeySheetProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (result: CreateLicenseKeyResponse) => void;
}

export function CreateLicenseKeySheet({ isOpen, onClose, onCreated }: CreateLicenseKeySheetProps) {
  const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);
  const schema = useMemo(() => createLicenseKeySchema(t), [t]);

  const form = useForm<CreateLicenseKeyFormValues>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULT_VALUES,
    mode: 'onSubmit',
  });

  const { control, handleSubmit, reset } = form;

  const onSubmit = async (values: CreateLicenseKeyFormValues) => {
    setSubmitting(true);
    try {
      const result = await licenseKeysService.createKey(values);
      reset(DEFAULT_VALUES);
      onCreated(result);
    } catch {
      toast.error(t('licenseKeysPage.createFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    reset(DEFAULT_VALUES);
    onClose();
  };

  return (
    <Sheet
      open={isOpen}
      onOpenChange={open => {
        if (!open) handleClose();
      }}
    >
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{t('licenseKeysPage.createTitle')}</SheetTitle>
          <SheetDescription>{t('licenseKeysPage.createDescription')}</SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <AppForm onSubmit={e => void handleSubmit(onSubmit)(e)}>
            <FormLayout>
              <FormSection title={t('common.general')} name='create-license-key-general'>
                <FormField
                  control={control}
                  name='name'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel tooltip={t('licenseKeysPage.nameTooltip')}>
                        {t('common.name')}
                      </FormLabel>
                      <FormControl>
                        <Input {...field} placeholder='e.g. Production' />
                      </FormControl>
                      <FormDescription>
                        <Accordion variant='common' type='single' collapsible>
                          <AccordionItem value='name-help'>
                            <AccordionTrigger>
                              {t('licenseKeysPage.nameHelpQuestion')}
                            </AccordionTrigger>
                            <AccordionContent>
                              {t('licenseKeysPage.nameHelpDescription')}
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={control}
                  name='origin'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel tooltip={t('licenseKeysPage.originTooltip')}>
                        {t('licenseKeysPage.table.origin')}
                      </FormLabel>
                      <FormControl>
                        <Input {...field} placeholder='https://data-marts.example.com' />
                      </FormControl>
                      <FormDescription>
                        <Accordion variant='common' type='single' collapsible>
                          <AccordionItem value='origin-help'>
                            <AccordionTrigger>
                              {t('licenseKeysPage.originHelpQuestion')}
                            </AccordionTrigger>
                            <AccordionContent>
                              {t('licenseKeysPage.originHelpDescription')}
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </FormSection>
            </FormLayout>

            <FormActions>
              <Button type='button' variant='secondary' onClick={handleClose}>
                {t('common.cancel')}
              </Button>
              <Button type='submit' disabled={submitting}>
                {submitting ? <Loader2 className='mr-2 size-4 animate-spin' /> : null}
                {t('common.create')}
              </Button>
            </FormActions>
          </AppForm>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
