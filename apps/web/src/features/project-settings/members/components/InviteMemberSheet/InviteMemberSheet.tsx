import { useState, useCallback } from 'react';
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
import { Badge } from '@owox/ui/components/badge';
import { Button } from '@owox/ui/components/button';
import { Input } from '@owox/ui/components/input';
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
import { Loader2, Check, Copy, Link2, Clock, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { projectMembersService } from '../../../../../features/project-members/services/project-members.service';
import type { InviteMemberResponse } from '../../../../../features/project-members/services/project-members.service';
import {
  PROJECT_ROLE_VALUES,
  ROLE_SCOPE_VALUES,
} from '../../../../../features/project-members/types';
import { getRoleDisplayName } from '../../../../../features/idp/utils/role-display-name';
import { AddContextSheet } from '../../../../../features/contexts/components/AddContextSheet/AddContextSheet';
import { useMembersSettings } from '../../model/members-settings.context';
import { MemberFormFields } from '../MemberFormFields/MemberFormFields';
import type { ContextDto } from '../../../../../features/contexts/types/context.types';
import { useTranslation } from 'react-i18next';

const inviteMemberSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address').max(320),
  role: z.enum(PROJECT_ROLE_VALUES),
  roleScope: z.enum(ROLE_SCOPE_VALUES),
});

type InviteMemberFormValues = z.infer<typeof inviteMemberSchema>;

const DEFAULT_VALUES: InviteMemberFormValues = {
  email: '',
  role: 'viewer',
  roleScope: 'entire_project',
};

interface InviteMemberSheetProps {
  isOpen: boolean;
  contexts: ContextDto[];
  onClose: () => void;
  onInvited: () => void;
}

export function InviteMemberSheet({
  isOpen,
  contexts,
  onClose,
  onInvited,
}: InviteMemberSheetProps) {
  const { t } = useTranslation();
  const form = useForm<InviteMemberFormValues>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: DEFAULT_VALUES,
    mode: 'onChange',
  });
  const { control, handleSubmit, reset: resetForm } = form;
  const { members, refresh } = useMembersSettings();
  const [selectedContextIds, setSelectedContextIds] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [magicLinkResult, setMagicLinkResult] = useState<Extract<
    InviteMemberResponse,
    { kind: 'magic-link' }
  > | null>(null);
  const [copied, setCopied] = useState(false);
  const [addContextOpen, setAddContextOpen] = useState(false);

  const reset = useCallback(() => {
    resetForm(DEFAULT_VALUES);
    setSelectedContextIds([]);
    setMagicLinkResult(null);
    setCopied(false);
  }, [resetForm]);

  const handleClose = () => {
    if (sending) return;
    reset();
    onClose();
  };

  const handleDoneMagicLink = () => {
    setMagicLinkResult(null);
    reset();
    onInvited();
    onClose();
  };

  const handleCopyMagicLink = async () => {
    if (!magicLinkResult) return;
    try {
      await navigator.clipboard.writeText(magicLinkResult.magicLink);
      setCopied(true);
      toast.success(t('membersPage.magicLinkCopied', 'Magic link copied to clipboard'));
      window.setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      toast.error(
        t('membersPage.magicLinkCopyFailed', 'Failed to copy. Select the link and copy manually.')
      );
    }
  };

  const onSubmit = useCallback(
    async (values: InviteMemberFormValues) => {
      setSending(true);
      try {
        const isAdminRoleSelected = values.role === 'admin';
        const effectiveContextIds =
          !isAdminRoleSelected &&
          values.roleScope === 'selected_contexts' &&
          selectedContextIds.length > 0
            ? selectedContextIds
            : undefined;
        const result = await projectMembersService.inviteMember({
          email: values.email.trim(),
          role: values.role,
          roleScope: isAdminRoleSelected ? undefined : values.roleScope,
          contextIds: effectiveContextIds,
        });

        if (result.kind === 'magic-link') {
          setMagicLinkResult(result);
        } else {
          toast.success(
            result.message ??
              t('membersPage.invitationSent', {
                email: result.email,
                defaultValue: 'Invitation email sent to {{email}}',
              }),
            {
              duration: 6000,
            }
          );
          reset();
          onInvited();
          onClose();
        }
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : t('membersPage.invitationFailed', 'Failed to send invitation');
        toast.error(msg);
      } finally {
        setSending(false);
      }
    },
    [selectedContextIds, onInvited, onClose, reset, t]
  );

  const handleToggleContext = (contextId: string, checked: boolean) => {
    setSelectedContextIds(prev =>
      checked ? [...prev, contextId] : prev.filter(id => id !== contextId)
    );
  };

  return (
    <>
      <Sheet
        open={isOpen}
        onOpenChange={open => {
          if (!open) handleClose();
        }}
      >
        <SheetContent>
          {magicLinkResult ? (
            <>
              <SheetHeader>
                <SheetTitle className='flex items-center gap-2'>
                  <span className='bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-full'>
                    <Link2 className='h-4 w-4' />
                  </span>
                  {t('membersPage.invitationLinkReady', 'Invitation link ready')}
                </SheetTitle>
                <SheetDescription>
                  {t(
                    'membersPage.invitationLinkDescription',
                    'Share this one-time sign-in link with the invitee through any channel (email, Slack, etc.).'
                  )}
                </SheetDescription>
              </SheetHeader>

              <FormLayout>
                <FormSection title={t('membersPage.invitee', 'Invitee')} name='magic-link-invitee'>
                  <FormItem>
                    <div className='bg-muted/40 flex items-center justify-between gap-3 rounded-md border p-3'>
                      <div className='min-w-0'>
                        <div className='truncate text-sm font-medium'>{magicLinkResult.email}</div>
                        <div className='text-muted-foreground text-xs'>
                          {t('membersPage.willJoinAs', 'Will join as')}{' '}
                          {getRoleDisplayName(magicLinkResult.role)}
                        </div>
                      </div>
                      <Badge variant='outline' className='shrink-0'>
                        {getRoleDisplayName(magicLinkResult.role)}
                      </Badge>
                    </div>
                  </FormItem>
                </FormSection>

                <FormSection
                  title={t('membersPage.oneTimeLink', 'One-time link')}
                  name='magic-link-url'
                >
                  <FormItem>
                    <button
                      type='button'
                      onClick={() => {
                        void handleCopyMagicLink();
                      }}
                      className='group border-input hover:border-primary/40 hover:bg-muted/60 bg-muted/30 focus-visible:ring-ring flex w-full items-center gap-3 rounded-md border p-3 text-left transition focus-visible:ring-2 focus-visible:outline-none'
                      aria-label={t('membersPage.copyInvitationLink', 'Copy invitation link')}
                    >
                      <Link2 className='text-muted-foreground h-4 w-4 shrink-0' />
                      <span
                        className='text-foreground flex-1 truncate font-mono text-xs'
                        title={magicLinkResult.magicLink}
                      >
                        {magicLinkResult.magicLink}
                      </span>
                      <span className='text-muted-foreground group-hover:text-foreground shrink-0 text-xs'>
                        {copied ? (
                          <Check className='h-4 w-4 text-green-600' />
                        ) : (
                          <Copy className='h-4 w-4' />
                        )}
                      </span>
                    </button>
                    <div className='text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs'>
                      <span className='inline-flex items-center gap-1'>
                        <ShieldCheck className='h-3.5 w-3.5' />
                        {t('membersPage.singleUse', 'Single-use')}
                      </span>
                      {magicLinkResult.expiresAt && (
                        <span className='inline-flex items-center gap-1'>
                          <Clock className='h-3.5 w-3.5' />
                          {t('membersPage.expiresAt', 'Expires')}{' '}
                          {new Date(magicLinkResult.expiresAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </FormItem>
                </FormSection>
              </FormLayout>

              <FormActions>
                <Button
                  type='button'
                  className='w-full'
                  onClick={() => {
                    void handleCopyMagicLink();
                  }}
                >
                  {copied ? <Check className='mr-2 h-4 w-4' /> : <Copy className='mr-2 h-4 w-4' />}
                  {copied
                    ? t('membersPage.copiedToClipboard', 'Copied to clipboard')
                    : t('membersPage.copyInvitationLink', 'Copy invitation link')}
                </Button>
                <Button
                  type='button'
                  variant='outline'
                  className='w-full'
                  onClick={handleDoneMagicLink}
                >
                  {t('common.done', 'Done')}
                </Button>
              </FormActions>
            </>
          ) : (
            <>
              <SheetHeader>
                <SheetTitle>{t('membersPage.inviteTitle', 'Invite member')}</SheetTitle>
                <SheetDescription>
                  {t(
                    'membersPage.inviteDescription',
                    'Send an invitation via email. The member will receive a link to join the project.'
                  )}
                </SheetDescription>
              </SheetHeader>

              <Form {...form}>
                <AppForm
                  onSubmit={e => {
                    void handleSubmit(onSubmit)(e);
                  }}
                >
                  <FormLayout>
                    <FormSection title={t('common.general', 'General')} name='invite-general'>
                      <FormField
                        control={control}
                        name='email'
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel
                              tooltip={t('membersPage.emailTooltip', "The member's email address")}
                            >
                              {t('membersPage.email', 'Email')}
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type='email'
                                placeholder='user@company.com'
                                disabled={sending}
                                autoFocus
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </FormSection>

                    <MemberFormFields
                      contexts={contexts}
                      selectedContextIds={selectedContextIds}
                      onToggleContext={handleToggleContext}
                      disabled={sending}
                      onRequestCreateContext={() => {
                        setAddContextOpen(true);
                      }}
                      contextIdPrefix='invite-ctx'
                    />
                  </FormLayout>

                  <FormActions>
                    <Button type='submit' className='w-full' disabled={sending}>
                      {sending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                      {t('membersPage.sendInvitation', 'Send invitation')}
                    </Button>
                    <Button
                      type='button'
                      variant='outline'
                      className='w-full'
                      onClick={handleClose}
                      disabled={sending}
                    >
                      {t('common.cancel', 'Cancel')}
                    </Button>
                  </FormActions>
                </AppForm>
              </Form>
            </>
          )}
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
