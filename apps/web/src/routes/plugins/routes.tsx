import { lazy, Suspense, type ReactNode } from 'react';
import type { RouteObject } from 'react-router';
import { LayoutErrorBoundary } from '../../components/errors';
import { RouteLoading } from '../RouteLoading';

const PluginDetailsPage = lazy(() => import('../../pages/plugins/detail/PluginDetailsPage'));
const PluginsGalleryPage = lazy(() => import('../../pages/plugins/gallery/PluginsGalleryPage'));
const PluginHistoryPage = lazy(() => import('../../pages/plugins/history/PluginHistoryPage'));
const PluginRuntimePage = lazy(() => import('../../pages/plugins/runtime/PluginRuntimePage'));

function lazyElement(element: ReactNode) {
  return <Suspense fallback={<RouteLoading />}>{element}</Suspense>;
}

/**
 * Project-scoped plugin routes.
 *
 * The plugin page is reachable by direct link on purpose: §1 makes a link its own
 * discovery path, so it resolves even when nothing publishes the plugin to this member.
 */
export const pluginsRoutes: RouteObject[] = [
  {
    path: 'plugins',
    element: lazyElement(<PluginsGalleryPage />),
    errorElement: <LayoutErrorBoundary />,
  },
  {
    // Before :pluginId, or the router would read "history" as a plugin id.
    path: 'plugins/history',
    element: lazyElement(<PluginHistoryPage />),
    errorElement: <LayoutErrorBoundary />,
  },
  {
    path: 'plugins/run/:installationId',
    element: lazyElement(<PluginRuntimePage />),
    errorElement: <LayoutErrorBoundary />,
  },
  {
    path: 'plugins/:pluginId',
    element: lazyElement(<PluginDetailsPage />),
    errorElement: <LayoutErrorBoundary />,
  },
];
