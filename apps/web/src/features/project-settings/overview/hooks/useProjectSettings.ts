import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { projectSettingsApiService } from '../services';
import type { ProjectSettings } from '../types';

interface UseProjectSettingsResult {
  settings: ProjectSettings;
  isLoading: boolean;
  error: string | null;
  updateDescription: (description: string | null) => Promise<void>;
}

const EMPTY_SETTINGS: ProjectSettings = { description: null };

export function useProjectSettings(projectId: string): UseProjectSettingsResult {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<ProjectSettings>(EMPTY_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const activeProjectIdRef = useRef(projectId);
  activeProjectIdRef.current = projectId;

  useEffect(() => {
    const state = { cancelled: false };

    if (!projectId) {
      setSettings(EMPTY_SETTINGS);
      setIsLoading(false);
      return;
    }

    setSettings(EMPTY_SETTINGS);
    setIsLoading(true);
    setError(null);
    void projectSettingsApiService
      .getSettings()
      .then(response => {
        if (!state.cancelled) {
          setSettings(response);
        }
      })
      .catch((cause: unknown) => {
        if (!state.cancelled) {
          setError(
            cause instanceof Error ? cause.message : t('uiFeedback.projectDescriptionLoadFailed')
          );
        }
      })
      .finally(() => {
        if (!state.cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      state.cancelled = true;
    };
  }, [projectId, t]);

  const updateDescription = useCallback(
    async (description: string | null) => {
      const requestProjectId = activeProjectIdRef.current;

      try {
        const updated = await projectSettingsApiService.updateDescription(description);
        if (activeProjectIdRef.current === requestProjectId) {
          setSettings(updated);
          setError(null);
          toast.success(t('uiFeedback.projectDescriptionUpdated'));
        }
      } catch (cause) {
        const message =
          cause instanceof Error ? cause.message : t('uiFeedback.projectDescriptionUpdateFailed');
        if (activeProjectIdRef.current === requestProjectId) {
          toast.error(message);
        }
        throw cause;
      }
    },
    [t]
  );

  return { settings, isLoading, error, updateDescription };
}
