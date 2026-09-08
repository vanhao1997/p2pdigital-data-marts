import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { apiKeysService } from '../services/api-keys.service';
import type { ProjectMemberApiKey } from '../types';

export function useApiKeys() {
  const { t } = useTranslation();
  const [keys, setKeys] = useState<ProjectMemberApiKey[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchKeys = useCallback(async () => {
    try {
      const data = await apiKeysService.getKeys();
      setKeys(data);
    } catch {
      toast.error(t('uiFeedback.apiKeysLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void fetchKeys();
  }, [fetchKeys]);

  const revokeKey = useCallback(
    async (apiKeyId: string) => {
      try {
        await apiKeysService.revokeKey(apiKeyId);
        toast.success(t('uiFeedback.apiKeyRevoked'));
        void fetchKeys();
      } catch {
        toast.error(t('uiFeedback.apiKeyRevokeFailed'));
        void fetchKeys();
      }
    },
    [fetchKeys, t]
  );

  return { keys, loading, fetchKeys, revokeKey };
}
