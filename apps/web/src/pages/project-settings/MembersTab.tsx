import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { MembersTable } from '../../features/project-settings/members/components/MembersTable/MembersTable';
import { MemberDetailsSheet } from '../../features/project-settings/members/components/MemberDetailsSheet/MemberDetailsSheet';
import { PendingRequestsSection } from '../../features/project-settings/members/components/PendingRequestsSection/PendingRequestsSection';
import { UserProvisioningSettings } from '../../features/project-settings/members/components/UserProvisioningSettings/UserProvisioningSettings';
import { useMembersSettings } from '../../features/project-settings/members/model/members-settings.context';
import { ConfirmationDialog } from '../../shared/components/ConfirmationDialog';
import { projectMembersService } from '../../features/project-members/services/project-members.service';
import type { MemberWithScopeDto } from '../../features/contexts/types/context.types';

export function MembersTab() {
  const { t } = useTranslation();
  const {
    members,
    contexts,
    refresh,
    optimisticRemoveMember,
    isAdmin,
    openInviteSheet,
    hasLoadError,
  } = useMembersSettings();
  const [selected, setSelected] = useState<MemberWithScopeDto | null>(null);
  const [pendingRemove, setPendingRemove] = useState<MemberWithScopeDto | null>(null);
  const [removing, setRemoving] = useState(false);

  const openMemberSheet = (userId: string) => {
    const member = members.find(m => m.userId === userId);
    if (member) setSelected(member);
  };

  const requestRemove = (userId: string) => {
    const member = members.find(m => m.userId === userId);
    if (member) setPendingRemove(member);
  };

  const confirmRemove = async () => {
    if (!pendingRemove || removing) return;
    setRemoving(true);
    try {
      await projectMembersService.removeMember(pendingRemove.userId);
      // Legacy platform is eventually consistent — the next getMembers may
      // still echo the removed user. Drop them locally first so the row
      // disappears immediately; refresh() reconciles once upstream catches up.
      optimisticRemoveMember(pendingRemove.userId);
      toast.success(t('membersPage.removed', { email: pendingRemove.email }));
      setPendingRemove(null);
      void refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('membersPage.removeFailed'));
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className='flex flex-col gap-4'>
      <PendingRequestsSection />

      {!hasLoadError && <UserProvisioningSettings contexts={contexts} isAdmin={isAdmin} />}

      <MembersTable
        members={members}
        contexts={contexts}
        isAdmin={isAdmin}
        onRowClick={member => {
          if (isAdmin) setSelected(member);
        }}
        onEditMember={openMemberSheet}
        onRemoveMember={requestRemove}
        onInvite={openInviteSheet}
      />

      <MemberDetailsSheet
        isOpen={!!selected}
        member={selected}
        contexts={contexts}
        onClose={() => {
          setSelected(null);
        }}
        onSaved={() => {
          setSelected(null);
          void refresh();
        }}
      />

      <ConfirmationDialog
        open={!!pendingRemove}
        onOpenChange={open => {
          if (!open) setPendingRemove(null);
        }}
        title={t('membersPage.removeTitle')}
        description={
          <span className='mt-2 block'>
            {t('membersPage.removeDescription')}{' '}
            <strong>{pendingRemove?.displayName ?? pendingRemove?.email}</strong>{' '}
            {t('membersPage.removeDescriptionSuffix')}
            {` ${t('membersPage.removeWarning')}`}
          </span>
        }
        confirmLabel={t('membersPage.remove')}
        cancelLabel={t('common.cancel', 'Cancel')}
        variant='destructive'
        onConfirm={() => {
          void confirmRemove();
        }}
      />
    </div>
  );
}
