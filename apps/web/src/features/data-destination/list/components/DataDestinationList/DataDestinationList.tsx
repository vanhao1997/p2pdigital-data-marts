import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { ConfirmationDialog } from '../../../../../shared/components/ConfirmationDialog';
import { useUrlParam, useProjectRoute } from '../../../../../shared/hooks';
import { extractApiError } from '../../../../../app/api';
import { DataDestinationConfigSheet } from '../../../edit';
import {
  dataDestinationService,
  generateLookerStudioJsonConfig,
  useDataDestination,
} from '../../../shared';
import type { DataDestinationImpactResponseDto } from '../../../shared/services/types';
import { isLookerStudioCredentials } from '../../../shared/model/types/looker-studio-credentials.ts';
import {
  DataDestinationTable,
  type DataDestinationTableItem,
  getDataDestinationColumns,
} from '../DataDestinationTable';
import { useTranslation } from 'react-i18next';
import { mapDataDestinationFromDto } from '../../../shared/model/mappers/data-destination.mapper';
import { dataMartQueryKeys } from '../../../../data-marts/shared/query-keys';

interface DataDestinationListProps {
  isCreateSheetInitiallyOpen?: boolean;
  onCreateSheetClose?: () => void;
}

function buildReportsDestinationFilterPath(destinationTitle: string) {
  const params = new URLSearchParams({
    filters: JSON.stringify([{ f: 'destination', o: 'eq', v: [destinationTitle] }]),
  });

  return `/data-marts/reports?${params.toString()}`;
}

export const DataDestinationList = ({
  isCreateSheetInitiallyOpen = false,
  onCreateSheetClose,
}: DataDestinationListProps) => {
  const { t } = useTranslation();
  const {
    dataDestinations: contextDataDestinations,
    currentDataDestination,
    error: contextError,
    clearCurrentDataDestination,
    getDataDestinationById,
    deleteDataDestination,
    rotateSecretKey,
  } = useDataDestination();
  const { projectId: routeProjectId } = useProjectRoute();
  const projectId = routeProjectId ?? '';
  const queryClient = useQueryClient();
  const destinationsQuery = useQuery({
    queryKey: dataMartQueryKeys.destinations(projectId),
    enabled: Boolean(projectId),
    queryFn: async ({ signal }) => {
      const response = await dataDestinationService.getDataDestinations({ signal });
      return response.map(mapDataDestinationFromDto);
    },
  });
  const dataDestinations = useMemo(
    () => destinationsQuery.data ?? contextDataDestinations,
    [contextDataDestinations, destinationsQuery.data]
  );
  const loading =
    !destinationsQuery.data && dataDestinations.length === 0 && destinationsQuery.isLoading;
  const error =
    contextError ??
    (!destinationsQuery.data && dataDestinations.length === 0 && destinationsQuery.isError
      ? (extractApiError(destinationsQuery.error).message ??
        t('destinationsPage.loadFailed', 'Failed to load destinations. Please try again.'))
      : null);
  const { refetch: refetchDestinations } = destinationsQuery;
  const refreshDestinations = useCallback(() => refetchDestinations(), [refetchDestinations]);
  const invalidateDestinationGraph = useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: dataMartQueryKeys.destinationsRoot(projectId) }),
        queryClient.invalidateQueries({ queryKey: dataMartQueryKeys.destinationRoot(projectId) }),
        queryClient.invalidateQueries({ queryKey: dataMartQueryKeys.reportsRoot(projectId) }),
      ]),
    [projectId, queryClient]
  );

  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isRotateSecretKeyDialogOpen, setRotateSecretKeyDialogOpen] = useState(false);
  const [destinationToDelete, setDestinationToDelete] = useState<string | null>(null);
  const [destinationToRotateSecretKey, setDestinationToRotateSecretKey] = useState<string | null>(
    null
  );
  const [blocked, setBlocked] = useState<{
    destinationId: string;
    impact: DataDestinationImpactResponseDto;
  } | null>(null);
  const { scope } = useProjectRoute();

  const { value: deepLinkId, setParam: setIdParam, removeParam: removeIdParam } = useUrlParam('id');
  const hasAttemptedDeepLink = useRef(false);

  const handleEdit = useCallback(
    async (id: string) => {
      try {
        const dataDestination = await getDataDestinationById(id);
        if (!dataDestination) return;
        setIsEditSheetOpen(true);
        setIdParam(id);
      } catch {
        // The hook records the error and the HTTP layer surfaces the user-facing toast.
        // Do not open the sheet with stale or empty destination data.
      }
    },
    [getDataDestinationById, setIdParam]
  );

  const handleOpenCreateForm = useCallback(() => {
    clearCurrentDataDestination();
    setIsEditSheetOpen(true);
    onCreateSheetClose?.();
    removeIdParam();
  }, [clearCurrentDataDestination, onCreateSheetClose, removeIdParam]);

  useEffect(() => {
    if (!loading && dataDestinations.length > 0 && deepLinkId && !hasAttemptedDeepLink.current) {
      const destination = dataDestinations.find(d => d.id === deepLinkId);
      if (destination) {
        void handleEdit(deepLinkId);
      } else {
        toast.error(
          t('dataDestinationList.notFound', 'Destination not found by id {{id}}', {
            id: deepLinkId,
          })
        );
        removeIdParam();
      }
      hasAttemptedDeepLink.current = true;
    }
  }, [loading, dataDestinations, deepLinkId, removeIdParam, handleEdit, t]);

  useEffect(() => {
    if (isCreateSheetInitiallyOpen) {
      handleOpenCreateForm();
    }
  }, [isCreateSheetInitiallyOpen, handleOpenCreateForm]);

  const handleDelete = async (id: string) => {
    try {
      const impact = await dataDestinationService.getDataDestinationImpact(id);
      if (impact.reportsCount > 0) {
        setBlocked({ destinationId: id, impact });
        return;
      }
      setDestinationToDelete(id);
      setDeleteDialogOpen(true);
    } catch (error) {
      // Network/auth failures fall through to the plain confirm dialog so the
      // admin can still attempt the delete; the backend will surface the real
      // reason if there is one.
      console.error('Failed to load destination impact:', error);
      setDestinationToDelete(id);
      setDeleteDialogOpen(true);
    }
  };

  const handleRotateSecretKey = (id: string) => {
    setDestinationToRotateSecretKey(id);
    setRotateSecretKeyDialogOpen(true);
  };

  const handleConfirmRotateSecretKey = async () => {
    if (destinationToRotateSecretKey) {
      try {
        const updatedDestination = await rotateSecretKey(destinationToRotateSecretKey);
        if (isLookerStudioCredentials(updatedDestination.credentials)) {
          toast.success(
            t('dataDestinationList.newConfigCopied', 'New JSON Config copied to clipboard')
          );
          const jsonConfig = generateLookerStudioJsonConfig(updatedDestination.credentials);
          void navigator.clipboard.writeText(jsonConfig);
        }
        await refreshDestinations();
        await invalidateDestinationGraph();
      } catch (error) {
        console.error('Failed to rotate secret key:', error);
      } finally {
        setRotateSecretKeyDialogOpen(false);
        setDestinationToRotateSecretKey(null);
      }
    }
  };

  const handleConfirmDelete = async () => {
    if (destinationToDelete) {
      try {
        await deleteDataDestination(destinationToDelete);
        await refreshDestinations();
        await invalidateDestinationGraph();
      } catch (error) {
        console.error('Failed to delete destination:', error);
      } finally {
        setDeleteDialogOpen(false);
        setDestinationToDelete(null);
      }
    }
  };

  const handleSave = async () => {
    try {
      setIsEditSheetOpen(false);
      await refreshDestinations();
      await invalidateDestinationGraph();
      removeIdParam();
    } catch (error) {
      console.error('Failed to save destination:', error);
    }
  };

  const handleCloseSheet = () => {
    setIsEditSheetOpen(false);
    clearCurrentDataDestination();
    removeIdParam();
  };

  const tableData: DataDestinationTableItem[] = dataDestinations.map(destination => ({
    id: destination.id,
    title: destination.title,
    type: destination.type,
    createdAt: destination.createdAt,
    modifiedAt: destination.modifiedAt,
    credentials: destination.credentials,
    createdByUser: destination.createdByUser,
    ownerUsers: destination.ownerUsers,
    availableForUse: destination.availableForUse,
    availableForMaintenance: destination.availableForMaintenance,
    contexts: destination.contexts ?? [],
  }));

  const onDeleteCallback = (id: string) => {
    void handleDelete(id);
  };

  const columns = getDataDestinationColumns({
    onEdit: handleEdit,
    onDelete: onDeleteCallback,
    onRotateSecretKey: handleRotateSecretKey,
    t,
  });

  return (
    <div data-testid='destTab'>
      <DataDestinationTable
        columns={columns}
        data={tableData}
        onEdit={handleEdit}
        onOpenTypeDialog={handleOpenCreateForm}
        isLoading={loading}
        error={error}
        onRetry={() => void refreshDestinations()}
      />

      <DataDestinationConfigSheet
        isOpen={isEditSheetOpen}
        onClose={handleCloseSheet}
        dataDestination={currentDataDestination}
        onSaveSuccess={() => void handleSave()}
      />

      <ConfirmationDialog
        open={!!blocked}
        onOpenChange={open => {
          if (!open) setBlocked(null);
        }}
        title={t('dataDestinationList.cannotDelete', 'Cannot delete destination')}
        description={
          blocked ? (
            <span className='block space-y-2'>
              <span className='block'>
                <strong>&ldquo;{blocked.impact.destinationTitle}&rdquo;</strong>{' '}
                {t('dataDestinationList.isReferencedBy')}{' '}
                <Link
                  to={scope(buildReportsDestinationFilterPath(blocked.impact.destinationTitle))}
                  className='text-primary hover:underline'
                  onClick={() => {
                    setBlocked(null);
                  }}
                >
                  {t(
                    'dataDestinationList.referencedReports',
                    '{{reports}} Report{{reportSuffix}}',
                    {
                      reports: blocked.impact.reportsCount,
                      reportSuffix: blocked.impact.reportsCount === 1 ? '' : 's',
                    }
                  )}
                </Link>{' '}
                {t(
                  'dataDestinationList.acrossDataMarts',
                  'across {{dataMarts}} Data Mart{{dataMartSuffix}}.',
                  {
                    dataMarts: blocked.impact.dataMartCount,
                    dataMartSuffix: blocked.impact.dataMartCount === 1 ? '' : 's',
                  }
                )}
              </span>
              <span className='text-muted-foreground block'>
                {t(
                  'dataDestinationList.removeBeforeDelete',
                  'Remove or repoint those reports before deleting the destination.'
                )}
              </span>
            </span>
          ) : null
        }
        confirmLabel={t('dataDestinationList.gotIt', 'Got it')}
        variant='default'
        onConfirm={() => {
          setBlocked(null);
        }}
      />

      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={t('dataDestinationList.deleteTitle', 'Delete Destination')}
        description={t(
          'dataDestinationList.deleteDescription',
          'Are you sure you want to delete this destination? This action cannot be undone.'
        )}
        confirmLabel={t('common.delete', 'Delete')}
        cancelLabel={t('common.cancel', 'Cancel')}
        onConfirm={() => {
          void handleConfirmDelete();
        }}
        onCancel={() => {
          setDestinationToDelete(null);
        }}
        variant='destructive'
      />

      <ConfirmationDialog
        open={isRotateSecretKeyDialogOpen}
        onOpenChange={setRotateSecretKeyDialogOpen}
        title={t('dataDestinationList.rotateTitle', 'Rotate Secret Key')}
        description={t(
          'dataDestinationList.rotateDescription',
          'Rotating the secret key will invalidate the previous key'
        )}
        confirmLabel={t('dataDestinationList.rotateKey', 'Rotate Key')}
        cancelLabel={t('common.cancel', 'Cancel')}
        onConfirm={() => void handleConfirmRotateSecretKey()}
        onCancel={() => {
          setRotateSecretKeyDialogOpen(false);
        }}
        variant='destructive'
      >
        <div className='text-sm'>
          <p className='mb-2'>
            {t('dataDestinationList.afterRotation', 'After rotation, you will need to:')}
          </p>
          <ol className='mb-2 list-decimal pl-5'>
            <li>
              {t(
                'dataDestinationList.newConfigStep',
                'The new JSON Config will be automatically copied to your clipboard'
              )}
            </li>
            <li>{t('dataDestinationList.connectorStep', 'Go to your Data Studio Connector')}</li>
            <li>
              {t(
                'dataDestinationList.updateConfigStep',
                'Update the configuration with the new JSON Config'
              )}
            </li>
            <li>
              {t(
                'dataDestinationList.saveChangesStep',
                'Save the changes to restore access to your data marts'
              )}
            </li>
          </ol>
          <p className='font-semibold'>
            {t(
              'dataDestinationList.rotateQuestion',
              'Are you sure you want to rotate the secret key?'
            )}
          </p>
        </div>
      </ConfirmationDialog>
    </div>
  );
};
