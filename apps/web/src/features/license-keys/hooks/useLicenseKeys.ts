import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { licenseKeysService } from '../services/license-keys.service';
import type { LicenseKey } from '../types';

export function useLicenseKeys(enabled = true) {
  const { t } = useTranslation();
  const [keys, setKeys] = useState<LicenseKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    setError(null);
    try {
      setKeys(await licenseKeysService.getKeys());
    } catch {
      setError(t('uiFeedback.licenseKeysLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (enabled) void fetchKeys();
  }, [enabled, fetchKeys]);

  const revokeKey = useCallback(
    async (licenseKeyId: string) => {
      try {
        await licenseKeysService.revokeKey(licenseKeyId);
        toast.success(t('uiFeedback.licenseKeyRevoked'));
      } catch {
        toast.error(t('uiFeedback.licenseKeyRevokeFailed'));
      } finally {
        void fetchKeys();
      }
    },
    [fetchKeys, t]
  );

  return { keys, loading, error, fetchKeys, revokeKey };
}
