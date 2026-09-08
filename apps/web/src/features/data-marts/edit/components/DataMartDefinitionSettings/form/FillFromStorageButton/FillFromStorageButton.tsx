import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Database } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@owox/ui/components/dialog';
import { InputGroupButton } from '@owox/ui/components/input-group';
import { DataStorageType } from '../../../../../../data-storage';
import { dataStorageApiService } from '../../../../../../data-storage/shared/api';
import type {
  StorageNamespaceNodeDto,
  StorageResourceFilter,
  StorageResourceLeafDto,
} from '../../../../../../data-storage/shared/api/types';
import { UnhealthyStorageBlock } from '../../../../../../data-storage/shared/components';
import { useDataStorageHealthStatus } from '../../../../../../data-storage/shared/model/hooks/useDataStorageHealthStatus';
import { DataStorageHealthStatus } from '../../../../../../data-storage/shared/services/data-storage-health-status.service';
import { StorageResourceTree } from './StorageResourceTree';
import { extractStorageResourceError } from './storage-resource-error.utils';

/** Storage types that have a working resource browser on the backend. */
const STORAGE_TYPES_WITH_RESOURCE_BROWSER: ReadonlySet<DataStorageType> = new Set([
  DataStorageType.GOOGLE_BIGQUERY,
]);

interface FillFromStorageButtonProps {
  storageId: string;
  storageType: DataStorageType;
  resourceType: StorageResourceFilter;
  onSelect: (fullyQualifiedName: string) => void;
  hasValue?: boolean;
  autoOpen?: boolean;
}

export function FillFromStorageButton({
  storageId,
  storageType,
  resourceType,
  onSelect,
  hasValue = false,
  autoOpen = false,
}: FillFromStorageButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (autoOpen) {
      setOpen(true);
    }
  }, [autoOpen]);

  const [namespaces, setNamespaces] = useState<StorageNamespaceNodeDto[] | null>(null);
  const [namespacesError, setNamespacesError] = useState<string | null>(null);
  const [namespacesLoading, setNamespacesLoading] = useState(false);
  const {
    status: healthStatus,
    errorMessage: healthErrorMessage,
    isFetched: healthIsFetched,
  } = useDataStorageHealthStatus(storageId);
  const isUnhealthyStorage =
    healthIsFetched &&
    (healthStatus === DataStorageHealthStatus.UNCONFIGURED ||
      healthStatus === DataStorageHealthStatus.INVALID ||
      healthStatus === DataStorageHealthStatus.REAUTH_REQUIRED);

  const loadNamespaces = useCallback(async () => {
    setNamespacesLoading(true);
    setNamespacesError(null);
    try {
      const result = await dataStorageApiService.listStorageNamespaces(storageId);
      setNamespaces(result);
    } catch (error) {
      setNamespacesError(extractStorageResourceError(error));
      setNamespaces([]);
    } finally {
      setNamespacesLoading(false);
    }
  }, [storageId]);

  useEffect(() => {
    if (!open || namespaces !== null || namespacesLoading) return;
    if (!healthIsFetched || isUnhealthyStorage) return;
    void loadNamespaces();
  }, [open, namespaces, namespacesLoading, loadNamespaces, healthIsFetched, isUnhealthyStorage]);

  const handleSelect = useCallback(
    (resource: StorageResourceLeafDto) => {
      onSelect(resource.fullyQualifiedName);
      setOpen(false);
    },
    [onSelect]
  );

  const loadNamespaceResources = useCallback(
    async (namespaceId: string): Promise<StorageResourceLeafDto[]> => {
      return dataStorageApiService.listStorageResources(storageId, namespaceId, resourceType);
    },
    [storageId, resourceType]
  );

  if (!STORAGE_TYPES_WITH_RESOURCE_BROWSER.has(storageType)) {
    return null;
  }

  const resourceLabel = t(`storageResourcePicker.labels.${resourceType.toLowerCase()}`);
  const resourceLabelPlural = t(`storageResourcePicker.plurals.${resourceType.toLowerCase()}`);

  return (
    <>
      <InputGroupButton
        size={hasValue ? 'icon-xs' : 'xs'}
        variant='outline'
        onClick={() => {
          setOpen(true);
        }}
        title={
          hasValue
            ? t('storageResourcePicker.changeSelection')
            : t('storageResourcePicker.selectFromStorage')
        }
        aria-label={
          hasValue
            ? t('storageResourcePicker.changeSelection')
            : t('storageResourcePicker.selectFromStorage')
        }
      >
        <Database />
        {!hasValue && <span className='text-xs'>{t('common.select')}</span>}
      </InputGroupButton>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className='flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-4xl'>
          <DialogHeader className='px-6 pt-6 pb-6'>
            <DialogTitle>
              {t('storageResourcePicker.title', { resource: resourceLabel })}
            </DialogTitle>
            <DialogDescription>
              {t('storageResourcePicker.description', { resources: resourceLabelPlural })}
            </DialogDescription>
          </DialogHeader>
          <div className='bg-muted dark:bg-sidebar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto rounded-b-md border-t px-6 py-4'>
            {isUnhealthyStorage ? (
              <>
                <UnhealthyStorageBlock status={healthStatus} errorMessage={healthErrorMessage} />
              </>
            ) : (
              <section className='dm-card-block !gap-2'>
                <StorageResourceTree
                  namespaces={namespaces}
                  namespacesLoading={namespacesLoading}
                  namespacesError={namespacesError}
                  onRetryNamespaces={() => {
                    void loadNamespaces();
                  }}
                  loadNamespaceResources={loadNamespaceResources}
                  onSelectResource={handleSelect}
                  resourceType={resourceType}
                />
              </section>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
