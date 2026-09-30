import { useCallback } from 'react';
import { storageService } from '../../services/localstorage.service';
import { useContentPopovers } from '../../app/store/hooks/useContentPopovers';

interface UseOnboardingVideoParams {
  storageKey: string;
  popoverId: string;
  shouldShow: boolean;
}

export function useOnboardingVideo({
  storageKey,
  popoverId,
  shouldShow,
}: UseOnboardingVideoParams) {
  const { open } = useContentPopovers();
  // Videos are deliberately opened by an explicit user action (Help menu or a
  // contextual button). Keep this helper as the single place that records the
  // preference when a caller chooses to open one; it never opens a floating
  // video during render or on mobile automatically.
  return useCallback(() => {
    if (!shouldShow && storageService.get(storageKey, 'boolean')) return;
    storageService.set(storageKey, true);
    open(popoverId);
  }, [open, popoverId, shouldShow, storageKey]);
}
