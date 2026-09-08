import { type ColumnDef } from '@tanstack/react-table';
import { Button } from '@owox/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@owox/ui/components/dropdown-menu';
import { Copy, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import RelativeTime from '@owox/ui/components/common/relative-time';
import { SortableHeader, ToggleColumnsHeader } from '../../../../shared/components/Table';
import { toast } from 'sonner';
import type { LicenseKey } from '../../types';
import { ExpirationValue } from '../../../../shared/components/ExpirationValue/ExpirationValue';
import { UserReference } from '../../../../shared/components/UserReference';
import type { TFunction } from 'i18next';

interface LicenseKeysColumnsProps {
  onEdit?: (key: LicenseKey) => void;
  onRevoke?: (key: LicenseKey) => void;
  t: TFunction;
}

const relativeTimeCellClassName =
  'text-muted-foreground block max-w-full whitespace-normal break-words';

export const getLicenseKeysColumns = ({
  onEdit,
  onRevoke,
  t,
}: LicenseKeysColumnsProps): ColumnDef<LicenseKey>[] => [
  {
    accessorKey: 'name',
    size: 180,
    meta: { title: t('common.name') },
    header: ({ column }) => <SortableHeader column={column}>{t('common.name')}</SortableHeader>,
    cell: ({ row }) => <span className='font-medium'>{row.original.name}</span>,
  },
  {
    accessorKey: 'licenseKeyId',
    size: 240,
    meta: { title: t('licenseKeysPage.table.licenseKeyId') },
    header: ({ column }) => (
      <SortableHeader column={column}>{t('licenseKeysPage.table.licenseKeyId')}</SortableHeader>
    ),
    cell: ({ row }) => (
      <div className='flex items-center gap-1.5'>
        <code className='text-muted-foreground text-xs'>{row.original.licenseKeyId}</code>
        <Button
          variant='ghost'
          size='icon'
          className='size-6'
          aria-label={t('licenseKeysPage.table.copyId')}
          onClick={e => {
            e.stopPropagation();
            void navigator.clipboard
              .writeText(row.original.licenseKeyId)
              .then(() => toast.success(t('licenseKeysPage.table.idCopied')))
              .catch(() => toast.error(t('licenseKeysPage.table.copyFailed')));
          }}
        >
          <Copy className='size-3' />
        </Button>
      </div>
    ),
  },
  {
    accessorKey: 'origin',
    size: 240,
    meta: { title: t('licenseKeysPage.table.origin') },
    header: ({ column }) => (
      <SortableHeader column={column}>{t('licenseKeysPage.table.origin')}</SortableHeader>
    ),
    cell: ({ row }) => (
      <div className='flex items-center gap-1.5'>
        <code className='text-muted-foreground text-xs'>{row.original.origin}</code>
        <Button
          variant='ghost'
          size='icon'
          className='size-6'
          aria-label={t('licenseKeysPage.table.copyOrigin')}
          onClick={e => {
            e.stopPropagation();
            void navigator.clipboard
              .writeText(row.original.origin)
              .then(() => toast.success(t('licenseKeysPage.table.originCopied')))
              .catch(() => toast.error(t('licenseKeysPage.table.copyFailed')));
          }}
        >
          <Copy className='size-3' />
        </Button>
      </div>
    ),
  },
  {
    id: 'expiresAt',
    accessorFn: row => {
      const time = new Date(row.expiresAt).getTime();
      return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
    },
    size: 200,
    meta: { title: t('licenseKeysPage.table.expires') },
    sortingFn: 'basic',
    header: ({ column }) => (
      <SortableHeader column={column}>{t('licenseKeysPage.table.expires')}</SortableHeader>
    ),
    cell: ({ row }) => (
      <ExpirationValue
        expiresAt={row.original.expiresAt}
        expiredNotice={t('licenseKeysPage.expiredNotice')}
        expiringSoonNotice={t('licenseKeysPage.expiringSoonNotice')}
        focusable
      />
    ),
  },
  {
    accessorKey: 'createdAt',
    size: 130,
    meta: { title: t('common.createdAt') },
    header: ({ column }) => (
      <SortableHeader column={column}>{t('common.createdAt')}</SortableHeader>
    ),
    cell: ({ row }) => (
      <RelativeTime date={new Date(row.original.createdAt)} className={relativeTimeCellClassName} />
    ),
  },
  {
    accessorKey: 'lastUsedAt',
    size: 150,
    meta: { title: t('licenseKeysPage.table.lastActivity') },
    header: ({ column }) => (
      <SortableHeader column={column}>{t('licenseKeysPage.table.lastActivity')}</SortableHeader>
    ),
    cell: ({ row }) => {
      const { lastUsedAt } = row.original;
      if (!lastUsedAt)
        return <span className='text-muted-foreground'>{t('licenseKeysPage.table.never')}</span>;
      return <RelativeTime date={new Date(lastUsedAt)} className={relativeTimeCellClassName} />;
    },
  },
  {
    id: 'createdByUser',
    accessorFn: row => row.createdByUser?.fullName ?? row.createdByUser?.email ?? '',
    size: 200,
    meta: { title: t('common.createdBy') },
    header: ({ column }) => (
      <SortableHeader column={column}>{t('common.createdBy')}</SortableHeader>
    ),
    cell: ({ row }) => {
      const creator = row.original.createdByUser;
      if (!creator) return <span className='text-muted-foreground'>—</span>;
      return <UserReference userProjection={creator} />;
    },
  },
  {
    id: 'actions',
    size: 60,
    enableResizing: false,
    header: ({ table }) => <ToggleColumnsHeader table={table} />,
    cell: ({ row }) =>
      onEdit && onRevoke ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='ghost' size='icon' className='size-7' aria-label={t('common.actions')}>
              <MoreHorizontal className='size-4' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            <DropdownMenuItem
              onClick={() => {
                onEdit(row.original);
              }}
            >
              <Pencil className='mr-2 size-4' />
              {t('apiKeysPage.table.editName')}
            </DropdownMenuItem>
            <DropdownMenuItem
              className='text-red-600 focus:text-red-600'
              onClick={() => {
                onRevoke(row.original);
              }}
            >
              <Trash2 className='mr-2 size-4' />
              {t('licenseKeysPage.revokeButton')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null,
  },
];
