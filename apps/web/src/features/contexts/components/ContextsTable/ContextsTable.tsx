import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Row } from '@tanstack/react-table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@owox/ui/components/tooltip';
import { BaseTable, TableColumnSearch, TableCTAButton } from '../../../../shared/components/Table';
import { useBaseTable } from '../../../../shared/hooks/useBaseTable';
import type { UserProjection } from '../../../../shared/types';
import { getContextsColumns, ContextsColumnKey, type ContextsTableItem } from './columns';
import type { ContextDto, MemberWithScopeDto } from '../../types/context.types';

interface ContextsTableProps {
  contexts: ContextDto[];
  members: MemberWithScopeDto[];
  isAdmin: boolean;
  onRowClick?: (context: ContextDto) => void;
  onEditContext?: (contextId: string) => void;
  onDeleteContext?: (contextId: string) => void;
  onAddContext?: () => void;
}

export function ContextsTable({
  contexts,
  members,
  isAdmin,
  onRowClick,
  onEditContext,
  onDeleteContext,
  onAddContext,
}: ContextsTableProps) {
  const { t, i18n } = useTranslation();
  const data: ContextsTableItem[] = useMemo(() => {
    const toProjection = (m: MemberWithScopeDto): UserProjection => ({
      userId: m.userId,
      fullName: m.displayName ?? null,
      email: m.email,
      avatar: m.avatarUrl ?? null,
    });

    const adminProjections = members.filter(m => m.role === 'admin').map(toProjection);

    const scopedByContext = new Map<string, UserProjection[]>();
    for (const m of members) {
      if (m.role === 'admin') continue;
      const projection = toProjection(m);
      for (const cid of m.contextIds) {
        const bucket = scopedByContext.get(cid);
        if (bucket) {
          bucket.push(projection);
        } else {
          scopedByContext.set(cid, [projection]);
        }
      }
    }

    return contexts.map(c => {
      const scoped = scopedByContext.get(c.id) ?? [];
      const seen = new Set<string>();
      const memberUsers: UserProjection[] = [];
      for (const u of [...adminProjections, ...scoped]) {
        if (seen.has(u.userId)) continue;
        seen.add(u.userId);
        memberUsers.push(u);
      }
      return { ...c, memberCount: memberUsers.length, memberUsers };
    });
  }, [contexts, members]);

  const columns = useMemo(
    () =>
      getContextsColumns({
        onEdit: onEditContext,
        onDelete: onDeleteContext,
        isAdmin,
        t,
        locale: i18n.language,
      }),
    [onEditContext, onDeleteContext, isAdmin, t, i18n.language]
  );

  const { table } = useBaseTable<ContextsTableItem>({
    data,
    columns,
    storageKeyPrefix: 'contexts-settings',
    enableRowSelection: false,
  });

  const handleRowClick = (row: Row<ContextsTableItem>, e: React.MouseEvent) => {
    if (
      e.target instanceof HTMLElement &&
      (e.target.closest('button') || e.target.closest('[role="menuitem"]'))
    ) {
      return;
    }
    onRowClick?.(row.original);
  };

  return (
    <div className='dm-card'>
      <BaseTable
        tableId='contexts-settings-table'
        table={table}
        onRowClick={handleRowClick}
        ariaLabel={t('contextsPage.tableAriaLabel')}
        paginationProps={{ displaySelected: false }}
        renderToolbarLeft={() => (
          <TableColumnSearch
            table={table}
            columnId={ContextsColumnKey.NAME}
            placeholder={t('contextsPage.searchByName')}
          />
        )}
        renderToolbarRight={
          onAddContext
            ? () => {
                const button = (
                  <TableCTAButton onClick={isAdmin ? onAddContext : undefined} disabled={!isAdmin}>
                    {t('contextsPage.addTitle')}
                  </TableCTAButton>
                );
                if (isAdmin) return button;
                return (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className='inline-block'>{button}</span>
                    </TooltipTrigger>
                    <TooltipContent>{t('contextsPage.adminOnlyHint')}</TooltipContent>
                  </Tooltip>
                );
              }
            : undefined
        }
        renderEmptyState={() => (
          <span role='status' aria-live='polite'>
            {t('contextsPage.emptyState')}
          </span>
        )}
      />
    </div>
  );
}
