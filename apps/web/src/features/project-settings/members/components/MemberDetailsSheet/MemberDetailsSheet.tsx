import { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@owox/ui/components/sheet';
import { Button } from '@owox/ui/components/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@owox/ui/components/select';
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
import { Loader2, User } from 'lucide-react';
import { toast } from 'sonner';
import { projectMembersService } from '../../../../../features/project-members/services/project-members.service';
import { getRoleDisplayName } from '../../../../../features/idp/utils/role-display-name';
import { ContextsCheckboxList } from '../../../../../features/contexts/components/ContextsCheckboxList';
import { AddContextSheet } from '../../../../../features/contexts/components/AddContextSheet/AddContextSheet';
import { useMembersSettings } from '../../model/members-settings.context';
import { useIsAdmin } from '../../../../../features/idp/hooks/useRole';
import {
  PROJECT_ROLE_VALUES,
  ROLE_SCOPE_VALUES,
} from '../../../../../features/project-members/types';
import type {
  ContextDto,
  MemberWithScopeDto,
} from '../../../../../features/contexts/types/context.types';

const memberDetailsSchema = z.object({
  role: z.enum(PROJECT_ROLE_VALUES),
  roleScope: z.enum(ROLE_SCOPE_VALUES),
});

type MemberDetailsFormValues = z.infer<typeof memberDetailsSchema>;

const DEFAULT_VALUES: MemberDetailsFormValues = {
  role: 'viewer',
  roleScope: 'entire_project',
};

interface MemberDetailsSheetProps {
  isOpen: boolean;
  member: MemberWithScopeDto | null;
  contexts: ContextDto[];
  onClose: () => void;
  onSaved: () => void;
}

export function MemberDetailsSheet({
  isOpen,
  member,
  contexts,
  onClose,
  onSaved,
}: MemberDetailsSheetProps) {
  const { t } = useTranslation();
  const form = useForm<MemberDetailsFormValues>({
    resolver: zodResolver(memberDetailsSchema),
    defaultValues: DEFAULT_VALUES,
    mode: 'onChange',
  });
  const { control, handleSubmit, watch, reset: resetForm, formState } = form;
  const role = watch('role');
  const roleScope = watch('roleScope');
  const isAdmin = useIsAdmin();
  const { members, refresh } = useMembersSettings();
  const [selectedContextIds, setSelectedContextIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [addContextOpen, setAddContextOpen] = useState(false);

  // Sync form + local context selection whenever the sheet opens for a new
  // member (the same component is mounted across rows).
  useEffect(() => {
    if (member) {
      resetForm({
        role: member.role,
        roleScope: member.roleScope,
      });
      setSelectedContextIds([...member.contextIds]);
    }
  }, [member, resetForm]);

  const initialContextIds = useMemo(() => member?.contextIds ?? [], [member]);
  const contextsDirty = useMemo(() => {
    if (selectedContextIds.length !== initialContextIds.length) return true;
    const a = [...selectedContextIds].sort();
    const b = [...initialContextIds].sort();
    return a.some((id, i) => id !== b[i]);
  }, [selectedContextIds, initialContextIds]);

  const handleToggle = (contextId: string, checked: boolean) => {
    setSelectedContextIds(prev =>
      checked ? [...prev, contextId] : prev.filter(id => id !== contextId)
    );
  };

  const onSubmit = useCallback(
    async (values: MemberDetailsFormValues) => {
      if (!member) return;
      setSaving(true);
      try {
        const result = await projectMembersService.updateMember(member.userId, {
          role: values.role,
          roleScope: values.roleScope,
          contextIds: selectedContextIds,
        });
        toast.success(t('membersPage.settingsUpdated'));
        if (result.roleStatus === 'pending' && result.message) {
          toast(result.message, { duration: 8000, icon: 'ℹ️' });
        }
        onSaved();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t('membersPage.saveFailed'));
      } finally {
        setSaving(false);
      }
    },
    [member, selectedContextIds, onSaved, t]
  );

  if (!member) return null;

  const isAdminRole = role === 'admin';

  return (
    <>
      <Sheet
        open={isOpen}
        onOpenChange={open => {
          if (!open) onClose();
        }}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{t('membersPage.configureTitle')}</SheetTitle>
            <SheetDescription>{t('membersPage.configureDescription')}</SheetDescription>
          </SheetHeader>

          <Form {...form}>
            <AppForm
              onSubmit={e => {
                void handleSubmit(onSubmit)(e);
              }}
            >
              <FormLayout>
                <FormSection title={t('common.general')} name='member-details-general'>
                  <FormItem>
                    <FormLabel tooltip={t('membersPage.identityTooltip')}>
                      {t('membersPage.identity')}
                    </FormLabel>
                    <div className='flex items-center gap-3'>
                      {member.avatarUrl ? (
                        <img
                          src={member.avatarUrl}
                          alt={member.displayName ?? member.email}
                          className='h-10 w-10 rounded-full object-cover'
                        />
                      ) : (
                        <div className='bg-muted text-muted-foreground flex h-10 w-10 items-center justify-center rounded-full'>
                          <User className='h-5 w-5' />
                        </div>
                      )}
                      <div className='flex flex-col'>
                        <span className='font-medium'>{member.displayName ?? member.email}</span>
                        <span className='text-muted-foreground text-xs'>{member.email}</span>
                      </div>
                    </div>
                  </FormItem>

                  <FormField
                    control={control}
                    name='role'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel tooltip={t('membersPage.roleTooltip')}>
                          {t('membersPage.role')}
                        </FormLabel>
                        <FormControl>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                            disabled={saving}
                          >
                            <SelectTrigger className='w-full'>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PROJECT_ROLE_VALUES.map(r => (
                                <SelectItem key={r} value={r}>
                                  {getRoleDisplayName(r)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                        <FormDescription>
                          <Accordion variant='common' type='single' collapsible>
                            <AccordionItem value='member-role-help'>
                              <AccordionTrigger>
                                {t('membersPage.roleHelp.question')}
                              </AccordionTrigger>
                              <AccordionContent>
                                <p className='mb-2'>
                                  <strong>{t('requestAccessPage.roles.viewer')}</strong> —{' '}
                                  {t('membersPage.roleHelp.businessUser')}
                                </p>
                                <p className='mb-2'>
                                  <strong>{t('requestAccessPage.roles.editor')}</strong> —{' '}
                                  {t('membersPage.roleHelp.technicalUser')}
                                </p>
                                <p>
                                  <strong>{t('requestAccessPage.roles.admin')}</strong> —{' '}
                                  {t('membersPage.roleHelp.projectAdmin')}
                                </p>
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                </FormSection>

                {isAdminRole ? (
                  <FormSection
                    title={t('membersPage.access')}
                    collapsible={false}
                    name='member-details-admin'
                  >
                    <FormItem className='mt-2'>
                      <p className='text-muted-foreground text-sm'>
                        {t('membersPage.adminAccessDescription')}
                      </p>
                    </FormItem>
                  </FormSection>
                ) : (
                  <>
                    <FormSection title={t('membersPage.scope')} name='member-details-scope'>
                      <FormField
                        control={control}
                        name='roleScope'
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel tooltip={t('membersPage.scopeTooltip')}>
                              {t('membersPage.roleScope')}
                            </FormLabel>
                            <FormControl>
                              <Select
                                value={field.value}
                                onValueChange={field.onChange}
                                disabled={saving}
                              >
                                <SelectTrigger className='w-full'>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value='entire_project'>
                                    {t('membersPage.entireProject')}
                                  </SelectItem>
                                  <SelectItem value='selected_contexts'>
                                    {t('membersPage.selectedContextsOnly')}
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </FormControl>
                            <FormMessage />
                            <FormDescription>
                              <Accordion variant='common' type='single' collapsible>
                                <AccordionItem value='scope-help'>
                                  <AccordionTrigger>
                                    {t('membersPage.scopeHelp.question')}
                                  </AccordionTrigger>
                                  <AccordionContent>
                                    <p className='mb-2'>
                                      <strong>{t('membersPage.entireProject')}</strong> —{' '}
                                      {t('membersPage.scopeHelp.entireProject')}
                                    </p>
                                    <p className='mb-2'>
                                      <strong>
                                        {t('membersPage.scopeHelp.selectedContextsLabel')}
                                      </strong>{' '}
                                      — {t('membersPage.scopeHelp.selectedContexts')}
                                    </p>
                                  </AccordionContent>
                                </AccordionItem>
                              </Accordion>
                            </FormDescription>
                          </FormItem>
                        )}
                      />
                    </FormSection>

                    {roleScope === 'selected_contexts' && (
                      <FormSection title={t('membersPage.contexts')} name='member-details-contexts'>
                        <FormItem>
                          <FormLabel tooltip={t('membersPage.contextsAssignedTooltip')}>
                            {t('membersPage.assignedContexts')}
                          </FormLabel>
                          <ContextsCheckboxList
                            idPrefix='member-ctx'
                            contexts={contexts}
                            selectedIds={selectedContextIds}
                            onToggle={handleToggle}
                            disabled={saving}
                            onRequestCreate={
                              isAdmin
                                ? () => {
                                    setAddContextOpen(true);
                                  }
                                : undefined
                            }
                          />
                          <FormDescription>
                            <Accordion variant='common' type='single' collapsible>
                              <AccordionItem value='member-contexts-help'>
                                <AccordionTrigger>
                                  {t('membersPage.contextHelp.question')}
                                </AccordionTrigger>
                                <AccordionContent>
                                  <p>{t('membersPage.contextHelp.description')}</p>
                                </AccordionContent>
                              </AccordionItem>
                            </Accordion>
                          </FormDescription>
                        </FormItem>
                      </FormSection>
                    )}
                  </>
                )}
              </FormLayout>

              <FormActions>
                <Button
                  type='submit'
                  className='w-full'
                  disabled={saving || (!formState.isDirty && !contextsDirty)}
                >
                  {saving && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                  {t('common.save')}
                </Button>
                <Button
                  type='button'
                  variant='outline'
                  className='w-full'
                  onClick={onClose}
                  disabled={saving}
                >
                  {t('common.cancel')}
                </Button>
              </FormActions>
            </AppForm>
          </Form>
        </SheetContent>
      </Sheet>
      <AddContextSheet
        isOpen={addContextOpen}
        members={members}
        onClose={() => {
          setAddContextOpen(false);
        }}
        onCreated={created => {
          setSelectedContextIds(prev => (prev.includes(created.id) ? prev : [...prev, created.id]));
          setAddContextOpen(false);
          void refresh();
        }}
      />
    </>
  );
}
