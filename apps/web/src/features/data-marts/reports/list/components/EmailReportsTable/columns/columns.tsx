import { type ColumnDef } from '@tanstack/react-table';
import { SortableHeader, ToggleColumnsHeader } from '../../../../../../../shared/components/Table';
import RelativeTime from '@owox/ui/components/common/relative-time';
import { EmailActionsCell } from '../EmailActionsCell';
import { StatusIcon } from '../../StatusIcon';
import type { DataMartReport } from '../../../../shared/model/types/data-mart-report';
import { ReportQuickRunCell } from '../../../../shared';
import { ReportColumnKey } from './columnKeys';
import { UserReference } from '../../../../../../../shared/components/UserReference';
import { UserAvatarGroup } from '../../../../../../../shared/components/UserAvatarGroup';
import { EmailReportTitleCell } from '../EmailReportTitleCell';
import type { TFunction } from 'i18next';

interface EmailTableColumnsProps {
  onDeleteSuccess?: () => void;
  onEditReport?: (report: DataMartReport) => void;
  t?: TFunction;
}

export const getEmailColumns = ({
  onDeleteSuccess,
  onEditReport,
  t: translate,
}: EmailTableColumnsProps = {}): ColumnDef<DataMartReport>[] => {
  const t = translate ?? ((_key: string, fallback: string) => fallback);
  const labels = {
    title: t('reportTable.title', 'Title'),
    lastRunDate: t('reportTable.lastRunDate', 'Last Run Date'),
    lastRunStatus: t('reportTable.lastRunStatus', 'Last Run Status'),
    createdBy: t('reportTable.createdBy', 'Created By'),
    owners: t('reportTable.owners', 'Owners'),
  };
  return [
    {
      id: 'quickRun',
      size: 40,
      enableResizing: false,
      enableSorting: false,
      enableHiding: false,
      header: () => null,
      cell: ({ row }) => <ReportQuickRunCell report={row.original} />,
    },
    {
      accessorKey: ReportColumnKey.TITLE,
      size: 320,
      enableColumnFilter: true,
      meta: {
        title: labels.title,
      },
      header: ({ column }) => <SortableHeader column={column}>{labels.title}</SortableHeader>,
      cell: ({ row }) => <EmailReportTitleCell report={row.original} />,
    },
    {
      accessorKey: ReportColumnKey.LAST_RUN_DATE,
      size: 250,
      meta: {
        title: labels.lastRunDate,
      },
      header: ({ column }) => <SortableHeader column={column}>{labels.lastRunDate}</SortableHeader>,
      cell: ({ row }) => {
        const lastRunTimestamp = row.original.lastRunDate;
        return (
          <div className='text-muted-foreground text-sm'>
            {lastRunTimestamp ? (
              <RelativeTime date={new Date(lastRunTimestamp)} />
            ) : (
              t('reportActions.neverRun', 'Never run')
            )}
          </div>
        );
      },
    },
    {
      accessorKey: ReportColumnKey.LAST_RUN_STATUS,
      size: 200,
      meta: {
        title: labels.lastRunStatus,
      },
      header: ({ column }) => (
        <SortableHeader column={column}>{labels.lastRunStatus}</SortableHeader>
      ),
      cell: ({ row }) =>
        row.original.lastRunStatus ? (
          <StatusIcon status={row.original.lastRunStatus} error={row.original.lastRunError} />
        ) : (
          <span className='text-muted-foreground text-sm'>&mdash;</span>
        ),
    },
    {
      id: ReportColumnKey.CREATED_BY,
      accessorFn: row => {
        const u = row.createdByUser;
        return u?.fullName ?? u?.email;
      },
      size: 200,
      meta: {
        title: labels.createdBy,
      },
      header: ({ column }) => <SortableHeader column={column}>{labels.createdBy}</SortableHeader>,
      cell: ({ row }) => {
        const user = row.original.createdByUser;
        if (!user) return <span className='text-muted-foreground'>-</span>;
        return <UserReference userProjection={user} />;
      },
    },
    {
      id: ReportColumnKey.OWNERS,
      accessorFn: row => {
        const owners = (row.ownerUsers ?? [])
          .map(u => u.fullName ?? u.email)
          .filter(Boolean)
          .join(', ');
        return owners || '';
      },
      size: 200,
      meta: {
        title: labels.owners,
      },
      header: ({ column }) => <SortableHeader column={column}>{labels.owners}</SortableHeader>,
      cell: ({ row }) => {
        const users = row.original.ownerUsers ?? [];
        if (users.length === 0)
          return (
            <span className='text-muted-foreground text-sm'>
              {t('reportActions.notAssigned', 'Not assigned')}
            </span>
          );
        if (users.length === 1) return <UserReference userProjection={users[0]} />;
        return <UserAvatarGroup users={users} />;
      },
    },
    {
      id: 'actions',
      size: 50,
      enableResizing: false,
      header: ({ table }) => <ToggleColumnsHeader table={table} />,
      cell: ({ row }) => (
        <EmailActionsCell row={row} onDeleteSuccess={onDeleteSuccess} onEditReport={onEditReport} />
      ),
    },
  ];
};
