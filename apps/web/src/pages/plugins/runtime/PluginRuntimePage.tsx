import { Button } from '@owox/ui/components/button';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  createPluginHostBridge,
  fetchRuntimeToken,
  pluginsService,
} from '../../../features/plugins';
import { useAuth } from '../../../features/idp';
import { useProjectId, useProjectRoute } from '../../../shared/hooks';

/**
 * Exactly two sandbox tokens, and never a third.
 *
 * Omitting allow-same-origin forces an opaque origin, which is what keeps the plugin
 * away from cookies, storage and this document. Adding it back while allow-scripts is
 * present is the classic sandbox escape, so the value is asserted in a test rather than
 * left to review.
 */
const SANDBOX = 'allow-scripts allow-downloads';

export default function PluginRuntimePage() {
  const { installationId } = useParams<{ installationId: string }>();
  const projectId = useProjectId();
  const { scope } = useProjectRoute();
  const { user } = useAuth();
  const navigate = useNavigate();
  const frameRef = useRef<HTMLIFrameElement>(null);
  /** Set when the bridge closes the channel itself, e.g. a failed handshake. */
  const [broken, setBroken] = useState(false);

  // Narrowed to a string here so the query function needs no assertion; the route
  // cannot match without it, so this branch is defensive rather than expected.
  const resolvedId = installationId ?? '';

  const { data, isLoading, error } = useQuery({
    queryKey: ['plugin-entry', projectId, resolvedId],
    queryFn: () => pluginsService.getEntryPoint(resolvedId),
    enabled: Boolean(projectId) && resolvedId.length > 0,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const openExternal = useCallback((url: string) => {
    // The sandbox denies the plugin both navigation and popups, so it asks and the host
    // decides. Anything but https is not a link worth opening on its behalf.
    if (url.startsWith('https://')) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, []);

  const navigateInApp = useCallback(
    (path: string) => {
      // The leading slash is the only shape check worth making: a relative path resolves
      // against this origin and would pass the comparison below. Everything that reaches
      // for another host -- "//evil.example/x", "/\evil.example/x" -- resolves to that
      // host and is caught by comparing origins, so no second shape check earns its place.
      if (!path.startsWith('/')) {
        return;
      }

      let target: URL;
      try {
        target = new URL(path, window.location.origin);
      } catch {
        return;
      }

      if (target.origin !== window.location.origin) {
        return;
      }

      void navigate(`${target.pathname}${target.search}${target.hash}`);
    },
    [navigate]
  );

  // One plugin's failed handshake says nothing about the next one, and this component
  // survives the switch between two installations.
  useEffect(() => {
    setBroken(false);
  }, [resolvedId]);

  useEffect(() => {
    const iframe = frameRef.current;
    if (!iframe || !data || !projectId || !user) {
      return;
    }

    const bridge = createPluginHostBridge({
      iframe,
      // Assigned by the bridge once it is listening, never by the markup: React commits
      // src before effects run, so a fast plugin's single announcement would be lost.
      src: data.deliveryUrl,
      apiOrigin: window.location.origin,
      context: {
        pluginId: data.pluginId,
        installationId: resolvedId,
        projectId,
        userId: user.id,
        theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
      },
      fetchRuntimeToken: fetchRuntimeToken(resolvedId),
      onOpenExternal: openExternal,
      onNavigate: navigateInApp,
      onBroken: () => {
        setBroken(true);
      },
    });

    return () => {
      bridge.dispose();
    };
    // `broken` is a dependency because it unmounts the frame: without it, clearing the
    // flag for the next installation would leave the remounted frame with no bridge.
  }, [data, projectId, resolvedId, user, openExternal, navigateInApp, broken]);

  if (isLoading) {
    return <PluginRuntimeMessage titleKey='pluginsPage.runtime.loading' />;
  }

  if (error || !data) {
    return (
      <PluginRuntimeMessage
        titleKey={
          isSuspended(error) ? 'pluginsPage.runtime.suspended' : 'pluginsPage.runtime.openFailed'
        }
        descriptionKey={
          isSuspended(error)
            ? 'pluginsPage.runtime.suspendedDescription'
            : 'pluginsPage.runtime.openFailedDescription'
        }
        backHref={scope('/plugins')}
      />
    );
  }

  // Unmounting the frame is the point: the channel is already closed, so leaving it
  // painted shows a plugin that answers nothing and reads as merely slow.
  if (broken) {
    return (
      <PluginRuntimeMessage
        titleKey='pluginsPage.runtime.openFailed'
        descriptionKey='pluginsPage.runtime.handshakeFailed'
        backHref={scope('/plugins')}
      />
    );
  }

  return (
    <iframe
      ref={frameRef}
      sandbox={SANDBOX}
      allow=''
      referrerPolicy='no-referrer'
      title={data.displayName}
      className='h-full w-full border-0'
    />
  );
}

function PluginRuntimeMessage({
  titleKey,
  descriptionKey,
  backHref,
}: {
  titleKey: string;
  descriptionKey?: string;
  backHref?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className='flex h-full flex-col items-center justify-center gap-3 p-8 text-center'>
      <h1 className='text-lg font-medium'>{t(titleKey)}</h1>
      {descriptionKey && (
        <p className='text-muted-foreground max-w-prose text-sm'>{t(descriptionKey)}</p>
      )}
      {backHref && (
        <Button asChild variant='outline'>
          <Link to={backHref}>{t('pluginsPage.runtime.back')}</Link>
        </Button>
      )}
    </div>
  );
}

/**
 * Suspension is a distinct state, not a generic failure: the member's installation is
 * intact and will work again, which is worth saying rather than implying it is broken.
 */
function isSuspended(error: unknown): boolean {
  return (
    (error as { response?: { data?: { code?: string } } } | null)?.response?.data?.code ===
    'PLUGIN_SUSPENDED'
  );
}
