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
import type { ProjectMemberApiKey } from '../../types';
import { toast } from 'sonner';
import { ApiKeyExpirationValue } from '../ApiKeyExpirationValue';
import type { TFunction } from 'i18next';

interface ApiKeysColumnsProps {
  onEditName: (key: ProjectMemberApiKey) => void;
  onRevoke: (key: ProjectMemberApiKey) => void;
  t: TFunction;
}

const relativeTimeCellClassName =
  'text-muted-foreground block max-w-full whitespace-normal break-words';

export const getApiKeysColumns = ({
  onEditName,
  onRevoke,
  t,
}: ApiKeysColumnsProps): ColumnDef<ProjectMemberApiKey>[] => [
  {
    accessorKey: 'name',
    size: 190,
    meta: { title: t('common.name') },
    header: ({ column }) => <SortableHeader column={column}>{t('common.name')}</SortableHeader>,
    cell: ({ row }) => <span className='font-medium'>{row.original.name}</span>,
  },
  {
    accessorKey: 'apiKeyId',
    size: 240,
    meta: { title: t('apiKeysPage.table.apiKeyId') },
    header: ({ column }) => (
      <SortableHeader column={column}>{t('apiKeysPage.table.apiKeyId')}</SortableHeader>
    ),
    cell: ({ row }) => (
      <div className='flex items-center gap-1.5'>
        <code className='text-muted-foreground text-xs'>{row.original.apiKeyId}</code>
        <Button
          variant='ghost'
          size='icon'
          className='size-6'
          aria-label={t('apiKeysPage.table.copyId')}
          onClick={e => {
            e.stopPropagation();
            void navigator.clipboard.writeText(row.original.apiKeyId);
            toast.success(t('apiKeysPage.table.idCopied'));
          }}
        >
          <Copy className='size-3' />
        </Button>
      </div>
    ),
  },
  {
    id: 'expiresAt',
    accessorFn: row =>
      row.expiresAt ? new Date(row.expiresAt).getTime() : Number.POSITIVE_INFINITY,
    size: 200,
    meta: { title: t('apiKeysPage.table.expires') },
    sortingFn: 'basic',
    header: ({ column }) => (
      <SortableHeader column={column}>{t('apiKeysPage.table.expires')}</SortableHeader>
    ),
    cell: ({ row }) => <ApiKeyExpirationValue expiresAt={row.original.expiresAt} />,
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
    accessorKey: 'lastAuthenticatedAt',
    size: 150,
    meta: { title: t('apiKeysPage.table.lastAuthenticated') },
    header: ({ column }) => (
      <SortableHeader column={column}>{t('apiKeysPage.table.lastAuthenticated')}</SortableHeader>
    ),
    cell: ({ row }) => {
      const { lastAuthenticatedAt } = row.original;
      if (!lastAuthenticatedAt)
        return <span className='text-muted-foreground'>{t('apiKeysPage.table.never')}</span>;
      return (
        <RelativeTime date={new Date(lastAuthenticatedAt)} className={relativeTimeCellClassName} />
      );
    },
  },
  {
    id: 'actions',
    size: 60,
    enableResizing: false,
    header: ({ table }) => <ToggleColumnsHeader table={table} />,
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant='ghost' size='icon' className='size-7'>
            <MoreHorizontal className='size-4' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          <DropdownMenuItem
            onClick={() => {
              onEditName(row.original);
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
            {t('apiKeysPage.revokeButton')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];
