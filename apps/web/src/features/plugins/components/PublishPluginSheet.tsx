import { zodResolver } from '@hookform/resolvers/zod';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { Button } from '@owox/ui/components/button';
import { ExternalAnchor } from '@owox/ui/components/common/external-anchor';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@owox/ui/components/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@owox/ui/components/sheet';
import { Loader2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  usePluginPublishing,
  usePublishableScopes,
  type PublishFailure,
} from '../hooks/usePluginPublications';
import { safeHttpsUrl } from '../safeHttpsUrl';
import type { PluginPublicationScope } from '../types';

const schema = z.object({
  repository: z
    .string()
    .min(1, 'A GitHub repository is required')
    .refine(
      value => /^[\w.-]+\/[\w.-]+$/.test(value.trim()) || value.trim().startsWith('https://'),
      'Use a repository URL or owner/name'
    ),
  scope: z.enum(['project', 'member']),
});

type PublishFormValues = z.infer<typeof schema>;

interface PublishPluginSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Publishes a plugin from the browser at project or member scope.
 *
 * There is deliberately no field for a target project or member. The server takes both
 * from the authenticated session, so a form field would be an invitation to try
 * publishing somewhere the caller has no authority -- and it would be ignored anyway.
 */
export function PublishPluginSheet({ isOpen, onClose }: PublishPluginSheetProps) {
  const { t } = useTranslation();
  const scopes = usePublishableScopes();
  const { publish, isPublishing } = usePluginPublishing();
  const [failure, setFailure] = useState<PublishFailure | null>(null);
  const installationHref = safeHttpsUrl(failure?.installationUrl);
  const scopeLabels: Record<PluginPublicationScope, string> = {
    deployment: t('pluginsPage.publishForm.scopes.deployment'),
    project: t('pluginsPage.publishForm.scopes.project'),
    member: t('pluginsPage.publishForm.scopes.member'),
  };

  const form = useForm<PublishFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { repository: '', scope: scopes.includes('project') ? 'project' : 'member' },
  });

  const submit = async (values: PublishFormValues) => {
    const result = await publish(values.repository.trim(), values.scope);
    if (result) {
      setFailure(result);
      return;
    }

    form.reset();
    setFailure(null);
    onClose();
  };

  return (
    <Sheet
      open={isOpen}
      onOpenChange={open => {
        if (!open) {
          setFailure(null);
          onClose();
        }
      }}
    >
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{t('pluginsPage.publishForm.title')}</SheetTitle>
          <SheetDescription>{t('pluginsPage.publishForm.description')}</SheetDescription>
        </SheetHeader>

        <Form {...form}>
          {/* AppForm is itself the <form>; nesting another one inside it is invalid HTML. */}
          <AppForm
            noValidate
            onSubmit={event => {
              void form.handleSubmit(submit)(event);
            }}
          >
            <FormLayout>
              <FormSection>
                <FormField
                  control={form.control}
                  name='repository'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('pluginsPage.publishForm.repository')}</FormLabel>
                      <FormControl>
                        <Input placeholder='p2pdigital/example-plugin' {...field} />
                      </FormControl>
                      <FormDescription>
                        {t('pluginsPage.publishForm.repositoryHelp')}
                      </FormDescription>
                      <FormMessage />

                      <FieldHelp
                        value='repository-help'
                        title={t('pluginsPage.publishForm.repositoryQuestion')}
                      >
                        <p>{t('pluginsPage.publishForm.repositoryRules')}</p>
                        <p>{t('pluginsPage.publishForm.repositoryIdentity')}</p>
                        <p>{t('pluginsPage.publishForm.repositoryAccess')}</p>
                      </FieldHelp>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='scope'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('pluginsPage.publishForm.audience')}</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {scopes.map(scope => (
                            <SelectItem key={scope} value={scope}>
                              {scopeLabels[scope]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />

                      <FieldHelp
                        value='scope-help'
                        title={t('pluginsPage.publishForm.scopeQuestion')}
                      >
                        <p>{t('pluginsPage.publishForm.scopeOnlyMe')}</p>
                        <p>{t('pluginsPage.publishForm.scopeProject')}</p>
                        <p>{t('pluginsPage.publishForm.scopePublishOnly')}</p>
                        <p>{t('pluginsPage.publishForm.scopeIndependent')}</p>
                      </FieldHelp>
                    </FormItem>
                  )}
                />
              </FormSection>

              {failure && (
                <div className='text-destructive flex flex-col gap-2 rounded-md border p-3 text-sm'>
                  <p>{failure.message}</p>
                  {/*
                      The one publishing failure a member can actually resolve, and the
                      server hands back exactly where to go. Burying it in a toast would
                      hide the only thing that fixes it.
                    */}
                  {installationHref && (
                    <p>
                      <ExternalAnchor href={installationHref}>
                        {t('pluginsPage.publishForm.grantAccess')}
                      </ExternalAnchor>
                      {t('pluginsPage.publishForm.thenPublish')}
                    </p>
                  )}
                </div>
              )}
            </FormLayout>

            {/*
              Same sheet footer pattern as CreateApiKeySheet / other AppForm sheets:
              FormActions sits after FormLayout so Cancel/Publish stick to the bottom
              band with a top border, not float under the last field.
            */}
            <FormActions>
              <Button type='button' variant='secondary' onClick={onClose} disabled={isPublishing}>
                {t('common.cancel')}
              </Button>
              <Button type='submit' disabled={isPublishing}>
                {isPublishing ? <Loader2 className='size-4 animate-spin' aria-hidden /> : null}
                {isPublishing
                  ? t('pluginsPage.publishForm.publishing')
                  : t('pluginsPage.publishForm.publish')}
              </Button>
            </FormActions>
          </AppForm>
        </Form>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Collapsed explanation under a field.
 *
 * Collapsed by default on purpose: someone republishing a repository they know needs none
 * of this, while someone doing it the first time has to be told what the choice actually
 * changes -- and the sheet has room for one of those, not both.
 */
function FieldHelp({
  value,
  title,
  children,
}: {
  value: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <Accordion variant='common' type='single' collapsible>
      <AccordionItem value={value}>
        <AccordionTrigger>{title}</AccordionTrigger>
        <AccordionContent>{children}</AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
