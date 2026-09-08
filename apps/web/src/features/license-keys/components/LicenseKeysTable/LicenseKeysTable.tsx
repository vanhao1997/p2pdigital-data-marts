import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Row } from '@tanstack/react-table';
import { BaseTable, TableCTAButton } from '../../../../shared/components/Table';
import { useBaseTable } from '../../../../shared/hooks';
import { getLicenseKeysColumns } from './columns';
import type { LicenseKey } from '../../types';

interface LicenseKeysTableProps {
  keys: LicenseKey[];
  onCreateKey?: () => void;
  onEdit?: (key: LicenseKey) => void;
  onRevoke?: (key: LicenseKey) => void;
}

export function LicenseKeysTable({ keys, onCreateKey, onEdit, onRevoke }: LicenseKeysTableProps) {
  const { t } = useTranslation();
  const columns = useMemo(
    () => getLicenseKeysColumns({ onEdit, onRevoke, t }),
    [onEdit, onRevoke, t]
  );

  const { table } = useBaseTable<LicenseKey>({
    data: keys,
    columns,
    storageKeyPrefix: 'project-license-keys',
    enableRowSelection: false,
  });

  const handleRowClick = useCallback(
    (row: Row<LicenseKey>, e: React.MouseEvent) => {
      if (
        e.target instanceof Element &&
        (e.target.closest('button') ||
          e.target.closest('a') ||
          e.target.closest('[role="button"]') ||
          e.target.closest('[role="menuitem"]') ||
          e.target.closest('[role="checkbox"]'))
      ) {
        return;
      }

      onEdit?.(row.original);
    },
    [onEdit]
  );

  return (
    <div className='dm-card'>
      <BaseTable
        tableId='project-license-keys'
        table={table}
        onRowClick={onEdit ? handleRowClick : undefined}
        renderToolbarLeft={() => <div />}
        renderToolbarRight={
          onCreateKey
            ? () => (
                <TableCTAButton onClick={onCreateKey}>
                  {t('licenseKeysPage.createButton')}
                </TableCTAButton>
              )
            : () => <div />
        }
      />
    </div>
  );
}
