import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@owox/ui/components/sheet';
import {
  AppForm,
  Form,
  FormActions,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLayout,
  FormMessage,
  FormSection,
} from '@owox/ui/components/form';
import { Input } from '@owox/ui/components/input';
import { Button } from '@owox/ui/components/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiKeysService } from '../services/api-keys.service';
import type { CreateProjectMemberApiKeyResponse } from '../types';
import { ApiKeyDocumentationSection, ApiKeyFormLabel } from './ApiKeyFormShared';

const createApiKeySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  expiresAt: z.string().optional(),
});

type CreateApiKeyFormValues = z.infer<typeof createApiKeySchema>;

function generateDraftApiKeyName(): string {
  return `API key ${Math.floor(1000 + Math.random() * 9000)}`;
}

function createDefaultValues(): CreateApiKeyFormValues {
  return {
    name: generateDraftApiKeyName(),
    expiresAt: undefined,
  };
}

interface CreateApiKeySheetProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (result: CreateProjectMemberApiKeyResponse) => void;
}

export function CreateApiKeySheet({ isOpen, onClose, onCreated }: CreateApiKeySheetProps) {
  const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);
  const [initialDefaultValues] = useState<CreateApiKeyFormValues>(() => createDefaultValues());

  const form = useForm<CreateApiKeyFormValues>({
    resolver: zodResolver(createApiKeySchema),
    defaultValues: initialDefaultValues,
    mode: 'onChange',
  });

  const { control, handleSubmit, reset } = form;

  const onSubmit = async (values: CreateApiKeyFormValues) => {
    setSubmitting(true);
    try {
      const result = await apiKeysService.createKey({
        name: values.name,
        expiresAt: values.expiresAt ? `${values.expiresAt}T23:59:59.999Z` : undefined,
      });
      reset(createDefaultValues());
      onCreated(result);
    } catch {
      toast.error(t('apiKeysPage.form.createFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    reset(createDefaultValues());
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
          <SheetTitle>{t('apiKeysPage.form.title')}</SheetTitle>
          <SheetDescription>{t('apiKeysPage.form.description')}</SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <AppForm onSubmit={e => void handleSubmit(onSubmit)(e)}>
            <FormLayout>
              <FormSection title={t('formCommon.general')} name='create-api-key-general'>
                <FormField
                  control={control}
                  name='name'
                  render={({ field }) => (
                    <FormItem>
                      <ApiKeyFormLabel description={t('apiKeysPage.form.nameHelp')}>
                        {t('common.name')}
                      </ApiKeyFormLabel>
                      <FormControl>
                        <Input {...field} placeholder={t('apiKeysPage.form.namePlaceholder')} />
                      </FormControl>
                      <FormDescription>
                        <Accordion variant='common' type='single' collapsible>
                          <AccordionItem value='name-help'>
                            <AccordionTrigger>
                              {t('apiKeysPage.form.nameQuestion')}
                            </AccordionTrigger>
                            <AccordionContent>{t('apiKeysPage.form.nameAnswer')}</AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={control}
                  name='expiresAt'
                  render={({ field }) => (
                    <FormItem>
                      <ApiKeyFormLabel description={t('apiKeysPage.form.expiresHelp')}>
                        {t('apiKeysPage.form.expiresLabel')}
                      </ApiKeyFormLabel>
                      <FormControl>
                        <Input
                          type='date'
                          {...field}
                          value={field.value ?? ''}
                          min={new Date().toISOString().split('T')[0]}
                        />
                      </FormControl>
                      <FormDescription>
                        <Accordion variant='common' type='single' collapsible>
                          <AccordionItem value='expires-help'>
                            <AccordionTrigger>
                              {t('apiKeysPage.form.expiresQuestion')}
                            </AccordionTrigger>
                            <AccordionContent>
                              {t('apiKeysPage.form.expiresAnswer')}
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </FormSection>

              <ApiKeyDocumentationSection name='create-api-key-documentation' />
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
