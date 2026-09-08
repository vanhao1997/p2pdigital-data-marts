import type { ColumnDef } from '@tanstack/react-table';
import { InsightActionsCell } from '../InsightActionsCell';
import { SortableHeader, ToggleColumnsHeader } from '../../../../../../shared/components/Table';
import { formatDateShort } from '../../../../../../utils/date-formatters';
import { InsightColumnKey } from './columnKeys';
import { getInsightColumnLabels } from './columnLabels';

export interface InsightTableItem {
  id: string;
  title: string;
  lastRun: Date | null;
}

interface InsightColumnsProps {
  onDelete?: (id: string) => void;
  t: (key: string, defaultValue: string) => string;
}

export const getInsightColumns = ({
  onDelete,
  t,
}: InsightColumnsProps): ColumnDef<InsightTableItem>[] => {
  const labels = getInsightColumnLabels(t);
  return [
    {
      accessorKey: InsightColumnKey.TITLE,
      size: 320,
      meta: { title: labels[InsightColumnKey.TITLE] },
      header: ({ column }) => (
        <SortableHeader column={column}>{labels[InsightColumnKey.TITLE]}</SortableHeader>
      ),
      cell: ({ row }) => {
        const title = row.getValue<string>(InsightColumnKey.TITLE);
        return <div className='overflow-hidden text-ellipsis'>{title}</div>;
      },
    },
    {
      accessorKey: InsightColumnKey.LAST_RUN,
      size: 150,
      meta: { title: labels[InsightColumnKey.LAST_RUN] },
      sortDescFirst: true,
      header: ({ column }) => (
        <SortableHeader column={column}>{labels[InsightColumnKey.LAST_RUN]}</SortableHeader>
      ),
      cell: ({ row }) => {
        const date = row.getValue<Date>(InsightColumnKey.LAST_RUN);
        return <div className='text-muted-foreground'>{formatDateShort(date)}</div>;
      },
    },
    {
      id: 'actions',
      size: 80,
      enableResizing: false,
      header: ({ table }) => <ToggleColumnsHeader table={table} />,
      cell: ({ row }) => <InsightActionsCell id={row.original.id} onDelete={onDelete} />,
    },
  ];
};
