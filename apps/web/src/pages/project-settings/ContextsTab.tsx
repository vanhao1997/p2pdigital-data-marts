import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { ContextsTable } from '../../features/contexts/components/ContextsTable/ContextsTable';
import { ContextDetailsSheet } from '../../features/contexts/components/ContextDetailsSheet/ContextDetailsSheet';
import { useMembersSettings } from '../../features/project-settings/members/model/members-settings.context';
import { contextService } from '../../features/contexts/services/context.service';
import { useProjectRoute } from '../../shared/hooks';
import { ConfirmationDialog } from '../../shared/components/ConfirmationDialog';
import type { ContextDto, ContextImpactDto } from '../../features/contexts/types/context.types';

function buildContextsFilterUrl(basePath: string, contextId: string): string {
  const params = new URLSearchParams();
  params.set('filters', JSON.stringify([{ f: 'contexts', o: 'eq', v: [contextId] }]));
  return `${basePath}?${params.toString()}`;
}

export function ContextsTab() {
  const { t } = useTranslation();
  const { contexts, members, refresh, isAdmin, openAddContextSheet } = useMembersSettings();
  const { scope } = useProjectRoute();
  const [selected, setSelected] = useState<ContextDto | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ContextDto | null>(null);
  const [blocked, setBlocked] = useState<{
    context: ContextDto;
    impact: ContextImpactDto;
  } | null>(null);

  const openContextSheet = (contextId: string) => {
    const ctx = contexts.find(c => c.id === contextId);
    if (ctx) setSelected(ctx);
  };

  const handleDelete = async (contextId: string) => {
    const ctx = contexts.find(c => c.id === contextId);
    if (!ctx) return;
    try {
      const impact = await contextService.getContextImpact(contextId);
      const total =
        impact.dataMartCount +
        impact.storageCount +
        impact.destinationCount +
        impact.memberCount +
        impact.userProvisioningDefaultsCount;
      if (total > 0) {
        setBlocked({ context: ctx, impact });
      } else {
        setPendingDelete(ctx);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('contextsPage.loadImpactFailed'));
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await contextService.deleteContext(pendingDelete.id);
      toast.success(t('contextsPage.deleted'));
      setPendingDelete(null);
      void refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('contextsPage.deleteFailed'));
    }
  };

  const renderAttachments = (contextId: string, impact: ContextImpactDto) => {
    interface Part {
      label: string;
      to: string;
    }
    const parts: Part[] = [];
    if (impact.dataMartCount > 0)
      parts.push({
        label: `${String(impact.dataMartCount)} Data Mart${impact.dataMartCount === 1 ? '' : 's'}`,
        to: buildContextsFilterUrl(scope('/data-marts'), contextId),
      });
    if (impact.storageCount > 0)
      parts.push({
        label: `${String(impact.storageCount)} Storage${impact.storageCount === 1 ? '' : 's'}`,
        to: buildContextsFilterUrl(scope('/data-storages'), contextId),
      });
    if (impact.destinationCount > 0)
      parts.push({
        label: `${String(impact.destinationCount)} Destination${impact.destinationCount === 1 ? '' : 's'}`,
        to: buildContextsFilterUrl(scope('/data-destinations'), contextId),
      });
    if (impact.memberCount > 0)
      parts.push({
        label: `${String(impact.memberCount)} Member${impact.memberCount === 1 ? '' : 's'}`,
        to: scope('/project-settings/members'),
      });
    if (impact.userProvisioningDefaultsCount > 0)
      parts.push({
        label: `${String(impact.userProvisioningDefaultsCount)} User Provisioning Default${impact.userProvisioningDefaultsCount === 1 ? '' : 's'}`,
        to: scope('/project-settings/members'),
      });
    return parts.map((part, index) => (
      <span key={`${part.to}-${part.label}`}>
        {index > 0 && ', '}
        <Link
          to={part.to}
          className='text-primary hover:underline'
          onClick={() => {
            setBlocked(null);
          }}
        >
          {part.label}
        </Link>
      </span>
    ));
  };

  return (
    <>
      <ContextsTable
        contexts={contexts}
        members={members}
        isAdmin={isAdmin}
        onRowClick={ctx => {
          if (isAdmin) setSelected(ctx);
        }}
        onEditContext={openContextSheet}
        onDeleteContext={id => {
          void handleDelete(id);
        }}
        onAddContext={openAddContextSheet}
      />

      <ContextDetailsSheet
        isOpen={!!selected}
        context={selected}
        members={members}
        onClose={() => {
          setSelected(null);
        }}
        onSaved={() => {
          setSelected(null);
          void refresh();
        }}
      />

      <ConfirmationDialog
        open={!!pendingDelete}
        onOpenChange={open => {
          if (!open) setPendingDelete(null);
        }}
        title={t('contextsPage.deleteTitle')}
        description={
          <span>
            {t('contextsPage.deleteDescription')}{' '}
            <strong>&ldquo;{pendingDelete?.name ?? ''}&rdquo;</strong>{' '}
            {t('contextsPage.deleteDescriptionSuffix')}
          </span>
        }
        confirmLabel={t('common.delete', 'Delete')}
        cancelLabel={t('common.cancel', 'Cancel')}
        variant='destructive'
        onConfirm={() => {
          void confirmDelete();
        }}
      />

      <ConfirmationDialog
        open={!!blocked}
        onOpenChange={open => {
          if (!open) setBlocked(null);
        }}
        title={t('contextsPage.cannotDelete')}
        description={
          blocked ? (
            <span className='block space-y-2'>
              <span className='block'>
                <strong>&ldquo;{blocked.context.name}&rdquo;</strong>{' '}
                {t('contextsPage.blockedPrefix')}{' '}
                {renderAttachments(blocked.context.id, blocked.impact)}.
              </span>
              <span className='text-muted-foreground block'>{t('contextsPage.blockedSuffix')}</span>
            </span>
          ) : null
        }
        confirmLabel={t('contextsPage.gotIt')}
        variant='default'
        onConfirm={() => {
          setBlocked(null);
        }}
      />
    </>
  );
}
