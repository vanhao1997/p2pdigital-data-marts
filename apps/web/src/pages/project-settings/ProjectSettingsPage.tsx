import { useState, useEffect, useCallback, useMemo } from 'react';
import { NavLink, Outlet } from 'react-router';
import { cn } from '@owox/ui/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@owox/ui/components/alert';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useIsAdmin } from '../../features/idp/hooks/useRole';
import { useFlags } from '../../app/store/hooks';
import { checkVisible } from '../../utils/check-visible';
import { contextService } from '../../features/contexts/services/context.service';
import { projectMembersService } from '../../features/project-members/services/project-members.service';
import type { ContextDto, MemberWithScopeDto } from '../../features/contexts/types/context.types';
import type { MembershipRequestDto } from '../../features/project-members/types';
import { InviteMemberSheet } from '../../features/project-settings/members/components/InviteMemberSheet/InviteMemberSheet';
import { AddContextSheet } from '../../features/contexts/components/AddContextSheet/AddContextSheet';
import { MembersSettingsProvider } from '../../features/project-settings/members/model/MembersSettingsProvider';
import { MembershipRequestSheet } from '../../features/project-settings/members/components/MembershipRequestSheet/MembershipRequestSheet';
import { useTombstonedCollection } from '../../features/project-settings/members/model/useTombstonedCollection';
import type { PendingProjectInvitation } from '../../features/project-members/services/project-members.service';
import { useTranslation } from 'react-i18next';

interface TabLink {
  name: string;
  path: string;
  end: boolean;
}

/**
 * Project Settings shell: one page with tabs for Overview, Members, Contexts,
 * Credit Consumption, Subscription, Notification Settings. Replaces the old
 * /members page, which now redirects here.
 *
 * Members + contexts data is loaded here (not inside child tabs) because the
 * Invite member / Add context CTAs live in child-table toolbars and fire back
 * through the `MembersSettingsProvider` openers — keeping the sheet state at
 * this level means opening a sheet from one tab does not unmount state in
 * another. Tabs that do not need this data simply ignore the provider.
 */
export function ProjectSettingsPage() {
  const { t } = useTranslation();
  const isAdmin = useIsAdmin();
  const { flags } = useFlags();
  const isOwoxIdpProvider = checkVisible('IDP_PROVIDER', ['owox-better-auth'], flags);
  const licenseKeysEnabled = checkVisible('LICENSE_ISSUANCE_ENABLED', 'true', flags);
  const [contexts, setContexts] = useState<ContextDto[]>([]);
  const [members, setMembers] = useState<MemberWithScopeDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [addContextOpen, setAddContextOpen] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<MembershipRequestDto[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [requestSheetTarget, setRequestSheetTarget] = useState<MembershipRequestDto | null>(null);
  const [pendingInvitations, setPendingInvitations] = useState<PendingProjectInvitation[]>([]);

  const memberIdOf = useCallback((m: MemberWithScopeDto) => m.userId, []);
  const requestIdOf = useCallback((r: MembershipRequestDto) => r.requestId, []);
  const memberTombstones = useTombstonedCollection<MemberWithScopeDto>(memberIdOf);
  const requestTombstones = useTombstonedCollection<MembershipRequestDto>(requestIdOf);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadingRequests(isAdmin);
    setError(null);

    const requestsPromise = isAdmin
      ? projectMembersService.getMembershipRequests().catch((err: unknown) => {
          console.warn('Failed to load membership requests', err);
          return [] as MembershipRequestDto[];
        })
      : Promise.resolve<MembershipRequestDto[]>([]);
    try {
      const [ctxs, mems, reqs] = await Promise.all([
        contextService.getContexts(),
        projectMembersService.getMembers(),
        requestsPromise,
      ]);
      setContexts(ctxs);
      setMembers(memberTombstones.reconcile(mems));
      setPendingRequests(requestTombstones.reconcile(reqs));
      if (isAdmin) {
        setPendingInvitations(
          await projectMembersService.getInvitations().catch(() => [] as PendingProjectInvitation[])
        );
      }
    } catch (err) {
      // Without a catch the page renders empty arrays + loading=false, which
      // is indistinguishable from "this project really has no members /
      // contexts". Surface the error so the admin knows to retry.
      setError(
        err instanceof Error
          ? err.message
          : t('projectSettingsPage.loadFailed', 'Failed to load project data')
      );
    } finally {
      setLoading(false);
      setLoadingRequests(false);
    }
  }, [isAdmin, memberTombstones, requestTombstones, t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openInviteSheet = useCallback(() => {
    setInviteOpen(true);
  }, []);
  const openAddContextSheet = useCallback(() => {
    setAddContextOpen(true);
  }, []);
  const optimisticRemoveMember = useCallback(
    (userId: string) => {
      memberTombstones.tombstone(userId);
      setMembers(prev => prev.filter(m => m.userId !== userId));
    },
    [memberTombstones]
  );

  const optimisticRemoveRequest = useCallback(
    (requestId: string) => {
      requestTombstones.tombstone(requestId);
      setPendingRequests(prev => prev.filter(r => r.requestId !== requestId));
    },
    [requestTombstones]
  );

  const openMembershipRequestSheet = useCallback((request: MembershipRequestDto) => {
    setRequestSheetTarget(request);
  }, []);

  const handleResendInvitation = useCallback(
    async (invitation: PendingProjectInvitation) => {
      try {
        const refreshed = await projectMembersService.resendInvitation(
          invitation.invitationId ?? ''
        );
        setPendingInvitations(previous =>
          previous.map(item =>
            item.invitationId === refreshed.invitationId ? { ...item, ...refreshed } : item
          )
        );
        if (refreshed.magicLink) {
          await navigator.clipboard.writeText(refreshed.magicLink);
          toast.success(
            t('projectSettingsPage.newInvitationCopied', 'New invitation link copied to clipboard')
          );
        }
        await loadData();
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : t('projectSettingsPage.resendFailed', 'Failed to resend invitation')
        );
      }
    },
    [loadData, t]
  );

  const handleCopyInvitation = useCallback(
    async (invitation: PendingProjectInvitation) => {
      if (!invitation.magicLink) return;
      try {
        await navigator.clipboard.writeText(invitation.magicLink);
        toast.success(
          t('projectSettingsPage.invitationCopied', 'Invitation link copied to clipboard')
        );
      } catch {
        toast.error(
          t('projectSettingsPage.copyInvitationFailed', 'Failed to copy invitation link')
        );
      }
    },
    [t]
  );

  const navigation: TabLink[] = [
    { name: t('projectSettingsPage.tabs.overview', 'Overview'), path: '.', end: true },
    { name: t('projectSettingsPage.tabs.members', 'Members'), path: 'members', end: false },
    { name: t('projectSettingsPage.tabs.contexts', 'Contexts'), path: 'contexts', end: false },
    ...(isOwoxIdpProvider
      ? [
          {
            name: t('projectSettingsPage.tabs.credit', 'Credit consumption'),
            path: 'credit',
            end: false,
          },
          {
            name: t('projectSettingsPage.tabs.subscription', 'Subscription'),
            path: 'subscription',
            end: false,
          },
        ]
      : []),
    ...(licenseKeysEnabled
      ? [
          {
            name: t('projectSettingsPage.tabs.licenseKeys', 'License keys'),
            path: 'license-keys',
            end: false,
          },
        ]
      : []),
    {
      name: t('projectSettingsPage.tabs.notifications', 'Notifications'),
      path: 'notifications',
      end: false,
    },
    { name: t('projectSettingsPage.tabs.variables', 'Variables'), path: 'variables', end: false },
  ];

  // Stabilize the context value object so consumers do not re-render every
  // time `ProjectSettingsPage` itself rerenders for unrelated reasons (sheet
  // open/close state, etc.).
  const providerValue = useMemo(
    () => ({
      contexts,
      members,
      pendingRequests,
      loading,
      loadingRequests,
      hasLoadError: error !== null,
      refresh: loadData,
      optimisticRemoveMember,
      optimisticRemoveRequest,
      isAdmin,
      openInviteSheet,
      openAddContextSheet,
      openMembershipRequestSheet,
    }),
    [
      contexts,
      members,
      pendingRequests,
      loading,
      loadingRequests,
      error,
      loadData,
      optimisticRemoveMember,
      optimisticRemoveRequest,
      isAdmin,
      openInviteSheet,
      openAddContextSheet,
      openMembershipRequestSheet,
    ]
  );

  return (
    <MembersSettingsProvider value={providerValue}>
      <div className='min-w-0 px-4 py-6 sm:px-6 lg:px-8 xl:px-12'>
        <div className='mb-4 flex items-center gap-4'>
          <span className='text-2xl font-medium'>
            {t('projectSettingsPage.title', 'Project settings')}
          </span>
        </div>

        <nav
          className='no-scrollbar -mb-px flex gap-2 overflow-x-auto border-b whitespace-nowrap'
          aria-label={t('projectSettingsPage.tabsLabel', 'Tabs')}
        >
          {navigation.map(item => (
            <NavLink
              key={item.name}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'border-b-2 px-3 py-3 text-sm font-medium whitespace-nowrap sm:px-4 sm:py-4',
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-200 dark:hover:text-gray-200'
                )
              }
            >
              {item.name}
            </NavLink>
          ))}
        </nav>

        {error !== null && (
          <Alert variant='destructive' className='mt-4'>
            <AlertCircle className='h-4 w-4' />
            <AlertTitle>
              {t('projectSettingsPage.loadFailed', 'Could not load project data')}
            </AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className='pt-4'>
          {isAdmin && pendingInvitations.length > 0 && (
            <div className='mb-4 rounded-md border p-3 text-sm'>
              <div className='mb-2 font-medium'>
                {t('projectSettingsPage.pendingInvitations', 'Pending invitations')}
              </div>
              {pendingInvitations.map(invitation => (
                <div
                  key={invitation.invitationId ?? invitation.email}
                  className='flex items-center justify-between border-t py-2'
                >
                  <span>
                    {invitation.email} · {invitation.role} ·{' '}
                    {t('projectSettingsPage.expires', 'expires')}{' '}
                    {invitation.expiresAt
                      ? new Date(invitation.expiresAt).toLocaleDateString()
                      : t('projectSettingsPage.soon', 'soon')}
                  </span>
                  <div className='flex gap-2'>
                    <button
                      className='text-primary underline'
                      onClick={() => void handleResendInvitation(invitation)}
                    >
                      {t('projectSettingsPage.resend', 'Resend')}
                    </button>
                    {invitation.magicLink && (
                      <button
                        className='text-primary underline'
                        onClick={() => void handleCopyInvitation(invitation)}
                      >
                        {t('projectSettingsPage.copyLink', 'Copy link')}
                      </button>
                    )}
                    <button
                      className='text-destructive underline'
                      onClick={() =>
                        void projectMembersService
                          .revokeInvitation(invitation.invitationId ?? '')
                          .then(() => loadData())
                      }
                    >
                      {t('projectSettingsPage.revoke', 'Revoke')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Outlet />
        </div>

        <InviteMemberSheet
          isOpen={inviteOpen}
          onClose={() => {
            setInviteOpen(false);
          }}
          contexts={contexts}
          onInvited={() => {
            setInviteOpen(false);
            void loadData();
          }}
        />

        <AddContextSheet
          isOpen={addContextOpen}
          onClose={() => {
            setAddContextOpen(false);
          }}
          members={members}
          onCreated={() => {
            setAddContextOpen(false);
            void loadData();
          }}
        />

        <MembershipRequestSheet
          isOpen={requestSheetTarget !== null}
          request={requestSheetTarget}
          contexts={contexts}
          onClose={() => {
            setRequestSheetTarget(null);
          }}
          onResolved={resolved => {
            setRequestSheetTarget(null);
            if (resolved) void loadData();
          }}
        />
      </div>
    </MembersSettingsProvider>
  );
}
