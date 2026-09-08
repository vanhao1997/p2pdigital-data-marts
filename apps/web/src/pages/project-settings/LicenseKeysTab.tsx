import { useState } from 'react';
import { Navigate } from 'react-router';
import { AlertCircle, Plus, ShieldCheck } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@owox/ui/components/alert';
import { useTranslation } from 'react-i18next';
import { Button } from '@owox/ui/components/button';
import { useFlags } from '../../app/store/hooks';
import { useIsAdmin } from '../../features/idp/hooks/useRole';
import { checkVisible } from '../../utils/check-visible';
import { LicenseKeysTable } from '../../features/license-keys/components/LicenseKeysTable/LicenseKeysTable';
import { CreateLicenseKeySheet } from '../../features/license-keys/components/CreateLicenseKeySheet';
import { EditLicenseKeySheet } from '../../features/license-keys/components/EditLicenseKeySheet';
import { LicenseKeyRevealDialog } from '../../features/license-keys/components/LicenseKeyRevealDialog';
import { ConfirmationDialog } from '../../shared/components/ConfirmationDialog/ConfirmationDialog';
import { useLicenseKeys } from '../../features/license-keys/hooks/useLicenseKeys';
import type { CreateLicenseKeyResponse, LicenseKey } from '../../features/license-keys/types';

export function LicenseKeysTab() {
  const { t } = useTranslation();
  const { flags } = useFlags();
  const isAdmin = useIsAdmin();
  const enabled = !!flags && checkVisible('LICENSE_ISSUANCE_ENABLED', 'true', flags);
  const { keys, loading, error, fetchKeys, revokeKey } = useLicenseKeys(enabled);
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<LicenseKey | null>(null);
  const [revokingKey, setRevokingKey] = useState<LicenseKey | null>(null);
  const [createdKeyData, setCreatedKeyData] = useState<CreateLicenseKeyResponse | null>(null);

  if (flags && !enabled) {
    return <Navigate to='..' replace />;
  }

  const handleCreated = (result: CreateLicenseKeyResponse) => {
    setCreateSheetOpen(false);
    setCreatedKeyData(result);
    void fetchKeys();
  };

  const handleRevokeConfirm = async () => {
    if (!revokingKey) return;
    const keyToRevoke = revokingKey;
    setRevokingKey(null);
    setEditingKey(null);
    await revokeKey(keyToRevoke.licenseKeyId);
  };

  return (
    <div className='dm-page-content'>
      {loading ? (
        <div className='text-muted-foreground p-4'>{t('common.loading')}</div>
      ) : error ? (
        <Alert variant='destructive'>
          <AlertCircle className='h-4 w-4' />
          <AlertTitle>{t('licenseKeysPage.loadError')}</AlertTitle>
          <AlertDescription className='flex items-center gap-3'>
            {error}
            <Button
              variant='outline'
              size='sm'
              onClick={() => {
                void fetchKeys();
              }}
            >
              {t('common.retry')}
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <div className='flex flex-col gap-4'>
          {keys.length === 0 ? (
            <div className='dm-card'>
              <div className='dm-empty-state'>
                <ShieldCheck className='dm-empty-state-ico' strokeWidth={1} />
                <h2 className='dm-empty-state-title'>{t('licenseKeysPage.emptyTitle')}</h2>
                <p className='dm-empty-state-subtitle'>{t('licenseKeysPage.emptySubtitle')}</p>
                {isAdmin && (
                  <Button
                    variant='outline'
                    onClick={() => {
                      setCreateSheetOpen(true);
                    }}
                  >
                    <Plus className='h-4 w-4' />
                    {t('licenseKeysPage.createButton')}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <LicenseKeysTable
              keys={keys}
              onCreateKey={
                isAdmin
                  ? () => {
                      setCreateSheetOpen(true);
                    }
                  : undefined
              }
              onEdit={isAdmin ? setEditingKey : undefined}
              onRevoke={isAdmin ? setRevokingKey : undefined}
            />
          )}
          <div className='bg-muted/50 rounded-md border-b border-gray-200 px-4 py-3 dark:border-white/2 dark:bg-white/2'>
            <p className='text-muted-foreground text-sm'>{t('licenseKeysPage.infoNote')}</p>
          </div>
        </div>
      )}

      <CreateLicenseKeySheet
        isOpen={createSheetOpen}
        onClose={() => {
          setCreateSheetOpen(false);
        }}
        onCreated={handleCreated}
      />

      <EditLicenseKeySheet
        licenseKey={editingKey}
        onClose={() => {
          setEditingKey(null);
        }}
        onUpdated={() => {
          setEditingKey(null);
          void fetchKeys();
        }}
        onRevoke={setRevokingKey}
      />

      <LicenseKeyRevealDialog
        data={createdKeyData}
        onDone={() => {
          setCreatedKeyData(null);
        }}
      />

      <ConfirmationDialog
        open={!!revokingKey}
        onOpenChange={open => {
          if (!open) setRevokingKey(null);
        }}
        title={t('licenseKeysPage.revokeTitle')}
        description={
          <>
            {t('licenseKeysPage.revokeConfirm')} <strong>{revokingKey?.name}</strong>?{' '}
            {t('licenseKeysPage.revokeWarning')}
          </>
        }
        confirmLabel={t('licenseKeysPage.revokeButton')}
        variant='destructive'
        onConfirm={() => {
          void handleRevokeConfirm();
        }}
      />
    </div>
  );
}
