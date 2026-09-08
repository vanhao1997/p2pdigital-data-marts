import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { ConfirmationDialog } from '../../../../../shared/components/ConfirmationDialog';
import { useUrlParam, useProjectRoute } from '../../../../../shared/hooks';
import { DataStorageConfigSheet } from '../../../edit';
import { DataStorageType } from '../../../shared';
import { DataStorageTypeDialog } from '../../../shared/components/DataStorageTypeDialog.tsx';
import { useDataStorage } from '../../../shared/model/hooks/useDataStorage.ts';
import { usePublishDraftsTrigger } from '../../../shared/hooks/usePublishDraftsTrigger.ts';
import { DataStorageDetailsDialog } from '../DataStorageDetailsDialog';
import {
  DataStorageTable,
  type DataStorageTableItem,
  getDataStorageColumns,
} from '../DataStorageTable';
import { useTranslation } from 'react-i18next';
import { dataStorageApiService } from '../../../shared/api';
import { mapDataStorageListFromDto } from '../../../shared/model/mappers';
import { dataMartQueryKeys } from '../../../../data-marts/shared/query-keys';
import { extractApiError } from '../../../../../app/api';
import type { DataStorageList as DataStorageListItems } from '../../../shared/model/types/data-storage-list';

interface DataStorageListProps {
  initialTypeDialogOpen?: boolean;
  onTypeDialogClose?: () => void;
  onDataStoragesChange?: (dataStorages: DataStorageListItems) => void;
}

export const DataStorageList = ({
  initialTypeDialogOpen = false,
  onTypeDialogClose,
  onDataStoragesChange,
}: DataStorageListProps) => {
  const { t } = useTranslation();
  const [isTypeDialogOpen, setIsTypeDialogOpen] = useState(initialTypeDialogOpen);
  const [isCreatingDataStorage, setIsCreatingDataStorage] = useState(false);

  const {
    dataStorages: contextDataStorages,
    currentDataStorage,
    error: contextError,
    clearCurrentDataStorage,
    getDataStorageById,
    deleteDataStorage,
    createDataStorage,
  } = useDataStorage();
  const { projectId: routeProjectId } = useProjectRoute();
  const projectId = routeProjectId ?? '';
  const queryClient = useQueryClient();
  const storagesQuery = useQuery({
    queryKey: dataMartQueryKeys.storages(projectId),
    enabled: Boolean(projectId),
    queryFn: async ({ signal }) => {
      const response = await dataStorageApiService.getDataStorages({ signal });
      return response.map(mapDataStorageListFromDto);
    },
  });
  const dataStorages = useMemo(
    () => storagesQuery.data ?? contextDataStorages,
    [contextDataStorages, storagesQuery.data]
  );
  useEffect(() => {
    onDataStoragesChange?.(dataStorages);
  }, [dataStorages, onDataStoragesChange]);
  const loading = !storagesQuery.data && dataStorages.length === 0 && storagesQuery.isLoading;
  const error =
    contextError?.message ??
    (!storagesQuery.data && dataStorages.length === 0 && storagesQuery.isError
      ? (extractApiError(storagesQuery.error).message ??
        t('storagesPage.loadFailed', 'Failed to load storages. Please try again.'))
      : null);
  const { refetch: refetchStorages } = storagesQuery;
  const refreshStorages = useCallback(() => refetchStorages(), [refetchStorages]);
  const invalidateStorageGraph = useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: dataMartQueryKeys.storagesRoot(projectId) }),
        queryClient.invalidateQueries({ queryKey: dataMartQueryKeys.storageRoot(projectId) }),
        queryClient.invalidateQueries({ queryKey: dataMartQueryKeys.all(projectId) }),
      ]),
    [projectId, queryClient]
  );

  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [storageToDelete, setStorageToDelete] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<{
    storageId: string;
    storageTitle: string;
    publishedDataMartsCount: number;
    draftDataMartsCount: number;
  } | null>(null);
  const { scope } = useProjectRoute();
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [storageToPublish, setStorageToPublish] = useState<{
    id: string;
    draftDataMartsCount: number;
  } | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedStorageId, setSelectedStorageId] = useState<string | null>(null);

  const { value: deepLinkId, setParam: setIdParam, removeParam: removeIdParam } = useUrlParam('id');
  const hasAttemptedDeepLink = useRef(false);

  const handleEdit = useCallback(
    async (id: string) => {
      try {
        const dataStorage = await getDataStorageById(id);
        if (!dataStorage) return;
        setIsEditDrawerOpen(true);
        setIdParam(id);
      } catch {
        // The hook records the error and the HTTP layer surfaces the user-facing toast.
        // Do not open the drawer with stale or empty storage data.
      }
    },
    [getDataStorageById, setIdParam]
  );

  useEffect(() => {
    if (!loading && dataStorages.length > 0 && deepLinkId && !hasAttemptedDeepLink.current) {
      const storage = dataStorages.find(s => s.id === deepLinkId);
      if (storage) {
        void handleEdit(deepLinkId);
      } else {
        toast.error(
          t('dataStorageList.notFound', 'Storage not found by id {{id}}', { id: deepLinkId })
        );
        removeIdParam();
      }
      hasAttemptedDeepLink.current = true;
    }
  }, [loading, dataStorages, deepLinkId, removeIdParam, handleEdit, t]);

  useEffect(() => {
    setIsTypeDialogOpen(initialTypeDialogOpen);
  }, [initialTypeDialogOpen]);

  const handleTypeDialogClose = () => {
    setIsTypeDialogOpen(false);
    onTypeDialogClose?.();
  };

  const handleCreateNewStorage = async (type: DataStorageType) => {
    setIsCreatingDataStorage(true);
    try {
      const newStorage = await createDataStorage(type);
      await refreshStorages();
      await invalidateStorageGraph();
      handleTypeDialogClose();
      if (newStorage?.id) {
        await handleEdit(newStorage.id);
      }
    } catch (error) {
      console.error('Failed to create storage:', error);
    } finally {
      setIsCreatingDataStorage(false);
    }
  };

  const handleViewDetails = useCallback(
    async (id: string) => {
      setIsDetailsDialogOpen(false);
      setSelectedStorageId(null);
      clearCurrentDataStorage();
      try {
        // Resolve the detail before opening the dialog so a failed request cannot
        // leave an empty, non-loading dialog on screen.
        const dataStorage = await getDataStorageById(id);
        if (!dataStorage) return;
        setSelectedStorageId(id);
        setIsDetailsDialogOpen(true);
      } catch {
        // The hook records the error and the HTTP layer surfaces the user-facing toast.
        // Do not open the dialog with stale or empty storage data.
      }
    },
    [clearCurrentDataStorage, getDataStorageById]
  );

  const handleDetailsDialogClose = () => {
    setIsDetailsDialogOpen(false);
    setSelectedStorageId(null);
    clearCurrentDataStorage();
  };

  const handleDelete = (id: string) => {
    const storage = dataStorages.find(s => s.id === id);
    if (storage) {
      const total = storage.publishedDataMartsCount + storage.draftDataMartsCount;
      if (total > 0) {
        setBlocked({
          storageId: id,
          storageTitle: storage.title,
          publishedDataMartsCount: storage.publishedDataMartsCount,
          draftDataMartsCount: storage.draftDataMartsCount,
        });
        return;
      }
    }
    setStorageToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (storageToDelete) {
      try {
        await deleteDataStorage(storageToDelete);
        await refreshStorages();
        await invalidateStorageGraph();
      } catch (error) {
        console.error('Failed to delete storage:', error);
      } finally {
        setDeleteDialogOpen(false);
        setStorageToDelete(null);
      }
    }
  };

  const handlePublishDraftsRequest = (id: string): Promise<void> => {
    openPublishDraftsDialog(id);
    return Promise.resolve();
  };

  const openPublishDraftsDialog = (id: string) => {
    const storage = dataStorages.find(item => item.id === id);

    if (!storage || storage.draftDataMartsCount === 0) {
      return;
    }

    setStorageToPublish({
      id: storage.id,
      draftDataMartsCount: storage.draftDataMartsCount,
    });
    setPublishDialogOpen(true);
  };

  const handlePublishDraftsSuccess = useCallback(() => {
    void refreshStorages().then(() => invalidateStorageGraph());
  }, [invalidateStorageGraph, refreshStorages]);

  const { run: runPublishDraftsTrigger } = usePublishDraftsTrigger(handlePublishDraftsSuccess);

  const handleConfirmPublishDrafts = () => {
    if (!storageToPublish) {
      return;
    }

    const storageId = storageToPublish.id;
    setPublishDialogOpen(false);
    setStorageToPublish(null);

    void (async () => {
      await runPublishDraftsTrigger(storageId);
    })();
  };

  const handleSave = async (savedStorageId: string) => {
    try {
      setIsEditDrawerOpen(false);
      const result = await refreshStorages();
      await invalidateStorageGraph();
      const refreshedDataStorages = result.data ?? [];
      removeIdParam();
      const storage = refreshedDataStorages.find(item => item.id === savedStorageId);
      if (storage && storage.draftDataMartsCount > 0 && storage.publishedDataMartsCount === 0) {
        openPublishDraftsDialog(storage.id);
      }
    } catch (error) {
      console.error('Failed to save storage:', error);
    }
  };

  const handleCloseDrawer = () => {
    setIsEditDrawerOpen(false);
    clearCurrentDataStorage();
    removeIdParam();
  };

  const tableData: DataStorageTableItem[] = dataStorages.map(storage => ({
    id: storage.id,
    title: storage.title,
    type: storage.type,
    createdAt: storage.createdAt,
    modifiedAt: storage.modifiedAt,
    publishedDataMartsCount: storage.publishedDataMartsCount,
    draftDataMartsCount: storage.draftDataMartsCount,
    createdByUser: storage.createdByUser,
    ownerUsers: storage.ownerUsers,
    availableForUse: storage.availableForUse,
    availableForMaintenance: storage.availableForMaintenance,
    contexts: storage.contexts ?? [],
  }));

  const columns = getDataStorageColumns({
    onViewDetails: id => {
      void handleViewDetails(id);
    },
    onEdit: handleEdit,
    onDelete: handleDelete,
    onPublishDrafts: handlePublishDraftsRequest,
    t,
  });

  return (
    <div>
      <DataStorageTable
        columns={columns}
        data={tableData}
        onEdit={handleEdit}
        onOpenTypeDialog={() => {
          setIsTypeDialogOpen(true);
        }}
        isLoading={loading}
        error={error}
        onRetry={() => void refreshStorages()}
      />

      <DataStorageDetailsDialog
        isOpen={isDetailsDialogOpen}
        onClose={handleDetailsDialogClose}
        dataStorage={selectedStorageId ? currentDataStorage : null}
        isLoading={loading}
      />

      <DataStorageTypeDialog
        isOpen={isTypeDialogOpen}
        onClose={handleTypeDialogClose}
        onSelect={handleCreateNewStorage}
        isCreatingDataStorage={isCreatingDataStorage}
      />

      <DataStorageConfigSheet
        isOpen={isEditDrawerOpen}
        onClose={handleCloseDrawer}
        dataStorage={currentDataStorage}
        onSaveSuccess={dataStorage => void handleSave(dataStorage.id)}
      />

      <ConfirmationDialog
        open={!!blocked}
        onOpenChange={open => {
          if (!open) setBlocked(null);
        }}
        title={t('dataStorageList.cannotDelete', 'Cannot delete storage')}
        description={
          blocked ? (
            <span className='block space-y-2'>
              <span className='block'>
                <strong>&ldquo;{blocked.storageTitle}&rdquo;</strong>{' '}
                {t('dataStorageList.isReferencedBy')}{' '}
                <Link
                  to={`${scope('/data-marts')}?${new URLSearchParams({
                    filters: JSON.stringify([
                      { f: 'storageTitle', o: 'eq', v: [blocked.storageTitle] },
                    ]),
                  }).toString()}`}
                  className='text-primary hover:underline'
                  onClick={() => {
                    setBlocked(null);
                  }}
                >
                  {t('dataStorageList.referencedBy', '{{count}} Data Mart{{suffix}}', {
                    count: blocked.publishedDataMartsCount + blocked.draftDataMartsCount,
                    suffix:
                      blocked.publishedDataMartsCount + blocked.draftDataMartsCount === 1
                        ? ''
                        : 's',
                  })}
                </Link>
                {blocked.draftDataMartsCount > 0 && blocked.publishedDataMartsCount > 0 ? (
                  <>
                    {' '}
                    {t(
                      'dataStorageList.publishedDraftSummary',
                      '({{published}} published, {{draft}} draft)',
                      {
                        published: blocked.publishedDataMartsCount,
                        draft: blocked.draftDataMartsCount,
                      }
                    )}
                  </>
                ) : null}
                .
              </span>
              <span className='text-muted-foreground block'>
                {t(
                  'dataStorageList.detachBeforeDelete',
                  'Detach or delete those Data Marts before deleting the storage.'
                )}
              </span>
            </span>
          ) : null
        }
        confirmLabel={t('dataStorageList.gotIt', 'Got it')}
        variant='default'
        onConfirm={() => {
          setBlocked(null);
        }}
      />

      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={t('dataStorageList.deleteTitle', 'Delete Storage')}
        description={t(
          'dataStorageList.deleteDescription',
          'Are you sure you want to delete this storage? This action cannot be undone.'
        )}
        confirmLabel={t('common.delete', 'Delete')}
        cancelLabel={t('common.cancel', 'Cancel')}
        onConfirm={() => {
          void handleConfirmDelete();
        }}
        onCancel={() => {
          setStorageToDelete(null);
        }}
        variant='destructive'
      />

      <ConfirmationDialog
        open={publishDialogOpen}
        onOpenChange={setPublishDialogOpen}
        title={t('dataStorageList.publishDraftsTitle', 'Publish drafts')}
        description={
          <span>
            {t(
              'dataStorageList.publishDraftsDescription',
              'There are {{count}} data mart draft{{suffix}} available. We can publish {{pronoun}} now. Continue?',
              {
                count: storageToPublish?.draftDataMartsCount ?? 0,
                suffix: storageToPublish?.draftDataMartsCount === 1 ? '' : 's',
                pronoun: t('dataStorageList.publishPronoun', 'them'),
              }
            )}
          </span>
        }
        confirmLabel={t('dataStorageList.publish', 'Publish')}
        cancelLabel={t('dataStorageList.notNow', 'Not now')}
        onConfirm={() => {
          handleConfirmPublishDrafts();
        }}
        onCancel={() => {
          setStorageToPublish(null);
        }}
        variant='brand'
      />
    </div>
  );
};
