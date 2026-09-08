import { type ColumnDef } from '@tanstack/react-table';
import { SortableHeader, ToggleColumnsHeader } from '../../../../../shared/components/Table';
import { ContextBadges } from '../../../../../features/contexts/components/ContextBadges/ContextBadges';
import { getRoleDisplayName } from '../../../../../features/idp/utils/role-display-name';
import { UserAvatar, UserAvatarSize } from '../../../../../shared/components/UserAvatar';
import { generateInitials } from '../../../../../shared/utils';
import type {
  ContextDto,
  MemberWithScopeDto,
} from '../../../../../features/contexts/types/context.types';
import { MembersActionsCell } from './MembersActionsCell';
import type { TFunction } from 'i18next';

export interface MembersTableItem extends MemberWithScopeDto {
  contextsDetailed: ContextDto[];
}

export enum MembersColumnKey {
  NAME = 'displayName',
  EMAIL = 'email',
  ROLE = 'role',
  SCOPE = 'roleScope',
  CONTEXTS = 'contexts',
}

export const membersColumnLabels: Record<MembersColumnKey, string> = {
  [MembersColumnKey.NAME]: 'Name',
  [MembersColumnKey.EMAIL]: 'Email',
  [MembersColumnKey.ROLE]: 'Role',
  [MembersColumnKey.SCOPE]: 'Scope',
  [MembersColumnKey.CONTEXTS]: 'Contexts',
};

interface MembersColumnsProps {
  onEdit?: (userId: string) => void;
  onRemove?: (userId: string) => void;
  isAdmin?: boolean;
  t: TFunction;
}

export const getMembersColumns = ({
  onEdit,
  onRemove,
  isAdmin = false,
  t,
}: MembersColumnsProps): ColumnDef<MembersTableItem>[] => [
  {
    accessorKey: MembersColumnKey.NAME,
    size: 220,
    meta: { title: t('common.name') },
    header: ({ column }) => <SortableHeader column={column}>{t('common.name')}</SortableHeader>,
    cell: ({ row }) => {
      const { displayName, email, avatarUrl } = row.original;
      const name = displayName ?? email;
      const initials = generateInitials(displayName ?? null, email);
      return (
        <div className='flex items-center gap-3'>
          <UserAvatar
            avatar={avatarUrl ?? null}
            initials={initials}
            displayName={name}
            size={UserAvatarSize.NORMAL}
          />
          <span className='min-w-0 font-medium break-all'>{name}</span>
        </div>
      );
    },
  },
  {
    accessorKey: MembersColumnKey.EMAIL,
    size: 280,
    meta: { title: t('membersPage.email', 'Email') },
    header: ({ column }) => (
      <SortableHeader column={column}>{t('membersPage.email', 'Email')}</SortableHeader>
    ),
    cell: ({ row }) => <div className='text-muted-foreground break-all'>{row.original.email}</div>,
  },
  {
    accessorKey: MembersColumnKey.ROLE,
    size: 140,
    meta: { title: t('membersPage.role') },
    header: ({ column }) => (
      <SortableHeader column={column}>{t('membersPage.role')}</SortableHeader>
    ),
    cell: ({ row }) => (
      <span className='text-foreground text-sm'>{getRoleDisplayName(row.original.role)}</span>
    ),
  },
  {
    accessorKey: MembersColumnKey.SCOPE,
    size: 160,
    meta: { title: t('membersPage.scope') },
    header: ({ column }) => (
      <SortableHeader column={column}>{t('membersPage.scope')}</SortableHeader>
    ),
    cell: ({ row }) => {
      if (row.original.role === 'admin') {
        return <span className='text-muted-foreground'>—</span>;
      }
      return (
        <span className='text-foreground text-sm'>
          {row.original.roleScope === 'selected_contexts'
            ? t('membersPage.selected')
            : t('membersPage.entireProject')}
        </span>
      );
    },
  },
  {
    id: MembersColumnKey.CONTEXTS,
    accessorFn: row => row.contextsDetailed.map(c => c.name).join(', '),
    size: 280,
    enableSorting: false,
    meta: { title: t('projectMenu.contexts') },
    header: t('projectMenu.contexts'),
    cell: ({ row }) => {
      // Members with project-wide scope (admins and any other entire_project
      // member) implicitly belong to every context — render a dash to avoid
      // suggesting they are constrained by the context bindings.
      if (row.original.roleScope === 'entire_project') {
        return <span className='text-muted-foreground'>—</span>;
      }
      if (row.original.contextsDetailed.length === 0) {
        return <span className='text-muted-foreground'>—</span>;
      }
      return <ContextBadges contexts={row.original.contextsDetailed} />;
    },
  },
  {
    id: 'actions',
    size: 80,
    enableResizing: false,
    header: ({ table }) => <ToggleColumnsHeader table={table} />,
    cell: ({ row }) => (
      <MembersActionsCell
        userId={row.original.userId}
        isAdmin={isAdmin}
        onEdit={onEdit}
        onRemove={onRemove}
      />
    ),
  },
];
