import { useCallback, useEffect, useState } from 'react';
import i18n from '../../../i18n';
import {
  type RequestAccessContext,
  userProvisioningService,
} from '../services/user-provisioning.service';

export function useRequestAccessContext() {
  const [context, setContext] = useState<RequestAccessContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setContext(await userProvisioningService.getRequestAccessContext());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : i18n.t('userProvisioning.loadRequestAccessFailed')
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    context,
    loading,
    error,
    refresh: load,
  };
}
