import type { ColumnDef } from '@tanstack/react-table';
import { Switch } from '@owox/ui/components/switch';
import { ReceiversAvatarGroup } from './ReceiversAvatarGroup';
import {
  getGroupingDelayDisplayLabel,
  getNotificationTitleDisplayLabel,
} from '../../types';
import type { NotificationSettingsItem } from '../../types';
import { SortableHeader } from '../../../../../shared/components/Table/SortableHeader';
import { ToggleColumnsHeader } from '../../../../../shared/components/Table/ToggleColumnsHeader';
import { NotificationSettingsActionsCell } from './NotificationSettingsActionsCell';
import type { TFunction } from 'i18next';

export enum NotificationSettingsColumnKey {
  TITLE = 'title',
  RECEIVERS = 'receivers',
  WEBHOOK_URL = 'webhookUrl',
  GROUPING_DELAY = 'groupingDelayCron',
  ENABLED = 'enabled',
}

export const notificationSettingsColumnLabels: Record<NotificationSettingsColumnKey, string> = {
  [NotificationSettingsColumnKey.TITLE]: 'Title',
  [NotificationSettingsColumnKey.RECEIVERS]: 'Recipients',
  [NotificationSettingsColumnKey.WEBHOOK_URL]: 'Webhook URL',
  [NotificationSettingsColumnKey.GROUPING_DELAY]: 'Grouping Delay',
  [NotificationSettingsColumnKey.ENABLED]: 'Status',
};

function getGroupingDelayLabel(cronExpression: string): string {
  return getGroupingDelayDisplayLabel(cronExpression);
}

interface GetNotificationSettingsColumnsOptions {
  onToggleEnabled: (setting: NotificationSettingsItem, enabled: boolean) => void | Promise<void>;
  onEdit: (setting: NotificationSettingsItem) => void;
  t: TFunction;
}

export function getNotificationSettingsColumns({
  onToggleEnabled,
  onEdit,
  t,
}: GetNotificationSettingsColumnsOptions): ColumnDef<NotificationSettingsItem>[] {
  const labels = {
    [NotificationSettingsColumnKey.TITLE]: t('common.title'),
    [NotificationSettingsColumnKey.RECEIVERS]: t('notificationsPage.recipients'),
    [NotificationSettingsColumnKey.WEBHOOK_URL]: 'Webhook URL',
    [NotificationSettingsColumnKey.GROUPING_DELAY]: t('notificationsPage.groupingDelay'),
    [NotificationSettingsColumnKey.ENABLED]: t('common.status'),
  };
  return [
    {
      id: NotificationSettingsColumnKey.TITLE,
      accessorKey: 'title',
      size: 300,
      minSize: 150,
      meta: {
        title: labels[NotificationSettingsColumnKey.TITLE],
      },
      header: ({ column }) => (
        <SortableHeader column={column}>
          {labels[NotificationSettingsColumnKey.TITLE]}
        </SortableHeader>
      ),
      cell: ({ row }) => (
        <span className='font-medium'>
          {getNotificationTitleDisplayLabel(row.original.title)}
        </span>
      ),
    },
    {
      id: NotificationSettingsColumnKey.RECEIVERS,
      accessorKey: 'receivers',
      size: 160,
      meta: {
        title: labels[NotificationSettingsColumnKey.RECEIVERS],
      },
      header: ({ column }) => (
        <SortableHeader column={column}>
          {labels[NotificationSettingsColumnKey.RECEIVERS]}
        </SortableHeader>
      ),
      cell: ({ row }) => <ReceiversAvatarGroup receivers={row.original.receivers} />,
    },
    {
      id: NotificationSettingsColumnKey.WEBHOOK_URL,
      accessorKey: 'webhookUrl',
      size: 220,
      meta: {
        title: labels[NotificationSettingsColumnKey.WEBHOOK_URL],
      },
      header: ({ column }) => (
        <SortableHeader column={column}>
          {labels[NotificationSettingsColumnKey.WEBHOOK_URL]}
        </SortableHeader>
      ),
      cell: ({ row }) =>
        row.original.webhookUrl ? (
          <span className='text-muted-foreground block min-w-0 truncate overflow-hidden text-sm whitespace-nowrap'>
            {row.original.webhookUrl}
          </span>
        ) : (
          <span className='text-muted-foreground text-sm'>—</span>
        ),
    },
    {
      id: NotificationSettingsColumnKey.GROUPING_DELAY,
      accessorKey: 'groupingDelayCron',
      size: 140,
      meta: {
        title: labels[NotificationSettingsColumnKey.GROUPING_DELAY],
      },
      header: ({ column }) => (
        <SortableHeader column={column}>
          {labels[NotificationSettingsColumnKey.GROUPING_DELAY]}
        </SortableHeader>
      ),
      cell: ({ row }) => (
        <span className='text-muted-foreground text-sm'>
          {getGroupingDelayLabel(row.original.groupingDelayCron)}
        </span>
      ),
    },
    {
      id: NotificationSettingsColumnKey.ENABLED,
      accessorKey: 'enabled',
      size: 80,
      meta: {
        title: labels[NotificationSettingsColumnKey.ENABLED],
      },
      header: ({ column }) => (
        <SortableHeader column={column}>
          {labels[NotificationSettingsColumnKey.ENABLED]}
        </SortableHeader>
      ),
      cell: ({ row }) => (
        <Switch
          data-testid='notifToggle'
          checked={row.original.enabled}
          onCheckedChange={checked => {
            void onToggleEnabled(row.original, checked);
          }}
          onClick={e => {
            e.stopPropagation();
          }}
          aria-label={`Toggle ${row.original.title}`}
        />
      ),
    },
    {
      id: 'actions',
      size: 80,
      enableResizing: false,
      header: ({ table }) => <ToggleColumnsHeader table={table} />,
      cell: ({ row }) => <NotificationSettingsActionsCell setting={row.original} onEdit={onEdit} />,
    },
  ];
}
