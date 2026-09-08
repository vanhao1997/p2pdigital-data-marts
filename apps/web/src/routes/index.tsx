import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { Navigate, type RouteObject } from 'react-router';
import MainLayout from '../layouts/MainLayout';
import About from '../pages/About';
import NotFound from '../pages/NotFound';
const DataMartsPage = lazy(() => import('../pages/data-marts/list/DataMartsPage.tsx'));
const DataMartInsightsPage = lazy(
  () => import('../pages/data-marts/insights/DataMartInsightsPage.tsx')
);
const DataMartReportsPage = lazy(
  () => import('../pages/data-marts/reports/DataMartReportsPage.tsx')
);
const DataMartRunsPage = lazy(() => import('../pages/data-marts/runs/DataMartRunsPage.tsx'));
const DataMartSchedulesPage = lazy(
  () => import('../pages/data-marts/schedules/DataMartSchedulesPage.tsx')
);
const ModelCanvasPage = lazy(() => import('../pages/data-marts/model-canvas/ModelCanvasPage.tsx'));
const DataMartDetailsPage = lazy(() =>
  import('../pages/data-marts/edit').then(module => ({ default: module.DataMartDetailsPage }))
);
const CreateDataMartPage = lazy(() => import('../pages/data-marts/create/CreateDataMartPage.tsx'));
const DataStorageListPage = lazy(() =>
  import('../pages/data-storage').then(module => ({ default: module.DataStorageListPage }))
);
const DataDestinationListPage = lazy(() =>
  import('../pages/data-destination/DataDestinationListPage').then(module => ({
    default: module.DataDestinationListPage,
  }))
);

const ProjectNotificationsPage = lazy(() =>
  import('../pages/notifications/project').then(module => ({
    default: module.ProjectNotificationsPage,
  }))
);

import { dataMartDetailsRoutes } from './data-marts/routes';
import { projectSettingsRoutes } from './project-settings/routes';
import { ProjectRedirect } from '../components/ProjectRedirect';
import { oauthRoutes } from './oauth.routes';
import { RootErrorBoundary, LayoutErrorBoundary } from '../components/errors';

import { ConnectFlowLayout } from '../layouts/ConnectFlowLayout';
const ConnectGoogleSheetsPage = lazy(() =>
  import('../pages/connect/ConnectGoogleSheetsPage').then(module => ({
    default: module.ConnectGoogleSheetsPage,
  }))
);
const ConnectGoogleSheetsDonePage = lazy(() =>
  import('../pages/connect/ConnectGoogleSheetsDonePage').then(module => ({
    default: module.ConnectGoogleSheetsDonePage,
  }))
);
import { pluginsRoutes } from './plugins/routes';

import { AuthGuard } from '../features/idp/components/AuthGuard';
const ProjectSettingsPage = lazy(() =>
  import('../pages/project-settings/ProjectSettingsPage').then(module => ({
    default: module.ProjectSettingsPage,
  }))
);
const RequestAccessPage = lazy(() =>
  import('../pages/request-access/RequestAccessPage').then(module => ({
    default: module.RequestAccessPage,
  }))
);
const LegacyRequestAccessRedirect = lazy(() =>
  import('../pages/request-access/LegacyRequestAccessRedirect').then(module => ({
    default: module.LegacyRequestAccessRedirect,
  }))
);
const MyApiKeysPage = lazy(() =>
  import('../features/api-keys/pages/MyApiKeysPage').then(module => ({
    default: module.MyApiKeysPage,
  }))
);
const SearchPage = lazy(() =>
  import('../pages/search/SearchPage').then(module => ({
    default: module.SearchPage,
  }))
);
const ProjectsPage = lazy(() =>
  import('../pages/projects/ProjectsPage').then(module => ({
    default: module.ProjectsPage,
  }))
);
import { RouteLoading } from './RouteLoading';

function lazyElement(element: ReactNode) {
  return <Suspense fallback={<RouteLoading />}>{element}</Suspense>;
}

const routes: RouteObject[] = [
  {
    path: '/projects',
    element: <AuthGuard>{lazyElement(<ProjectsPage />)}</AuthGuard>,
    errorElement: <RootErrorBoundary />,
  },
  {
    index: true,
    path: '/',
    element: <ProjectRedirect />,
    errorElement: <RootErrorBoundary />,
  },
  {
    path: '/ui/:projectId',
    element: <MainLayout />,
    errorElement: <RootErrorBoundary />,
    children: [
      {
        path: 'request-access',
        element: lazyElement(<RequestAccessPage />),
        errorElement: <LayoutErrorBoundary />,
      },
      {
        path: 'about',
        element: <About />,
        errorElement: <LayoutErrorBoundary />,
      },
      {
        index: true,
        element: lazyElement(<DataMartsPage />),
        errorElement: <LayoutErrorBoundary />,
      },
      ...pluginsRoutes,
      {
        path: 'data-marts',
        element: lazyElement(<DataMartsPage />),
        errorElement: <LayoutErrorBoundary />,
      },
      {
        path: 'data-marts/create',
        element: lazyElement(<CreateDataMartPage />),
        errorElement: <LayoutErrorBoundary />,
      },
      {
        path: 'data-marts/runs',
        element: lazyElement(<DataMartRunsPage />),
        errorElement: <LayoutErrorBoundary />,
      },
      {
        path: 'data-marts/schedules',
        element: lazyElement(<DataMartSchedulesPage />),
        errorElement: <LayoutErrorBoundary />,
      },
      {
        path: 'data-marts/reports',
        element: lazyElement(<DataMartReportsPage />),
        errorElement: <LayoutErrorBoundary />,
      },
      {
        path: 'data-marts/insights',
        element: lazyElement(<DataMartInsightsPage />),
        errorElement: <LayoutErrorBoundary />,
      },
      {
        path: 'data-marts/models',
        element: lazyElement(<ModelCanvasPage />),
        errorElement: <LayoutErrorBoundary />,
      },
      {
        path: 'data-marts/:id',
        element: lazyElement(<DataMartDetailsPage />),
        errorElement: <LayoutErrorBoundary />,
        children: dataMartDetailsRoutes,
      },
      {
        path: 'data-storages',
        element: lazyElement(<DataStorageListPage />),
        errorElement: <LayoutErrorBoundary />,
      },
      {
        path: 'data-destinations',
        element: lazyElement(<DataDestinationListPage />),
        errorElement: <LayoutErrorBoundary />,
      },
      {
        path: 'search',
        element: lazyElement(<SearchPage />),
        errorElement: <LayoutErrorBoundary />,
      },
      {
        path: 'project-settings',
        element: lazyElement(<ProjectSettingsPage />),
        errorElement: <LayoutErrorBoundary />,
        children: projectSettingsRoutes,
      },
      // Legacy redirects: old /members and /members/contexts bookmarks land on
      // the new Project Settings page. Kept as thin redirects for one release
      // cycle — remove once internal links are updated.
      {
        path: 'members',
        element: <Navigate to='../project-settings/members' replace />,
        errorElement: <LayoutErrorBoundary />,
      },
      {
        path: 'members/contexts',
        element: <Navigate to='../project-settings/contexts' replace />,
        errorElement: <LayoutErrorBoundary />,
      },
      {
        path: 'me/api-keys',
        element: lazyElement(<MyApiKeysPage />),
        errorElement: <LayoutErrorBoundary />,
      },
      {
        path: 'notifications',
        element: lazyElement(<ProjectNotificationsPage />),
        errorElement: <LayoutErrorBoundary />,
      },
      {
        path: '*',
        element: <NotFound />,
      },
    ],
  },
  {
    path: '/ui/:projectId/connect',
    element: <ConnectFlowLayout />,
    errorElement: <RootErrorBoundary />,
    children: [
      {
        path: 'google-sheets',
        element: lazyElement(<ConnectGoogleSheetsPage />),
        errorElement: <LayoutErrorBoundary />,
      },
      {
        path: 'google-sheets/done',
        element: lazyElement(<ConnectGoogleSheetsDonePage />),
        errorElement: <LayoutErrorBoundary />,
      },
    ],
  },
  {
    ...oauthRoutes,
    errorElement: <RootErrorBoundary />,
  },
  {
    path: '/request-access',
    element: lazyElement(<LegacyRequestAccessRedirect />),
    errorElement: <RootErrorBoundary />,
  },
  {
    path: '*',
    element: <NotFound />,
    errorElement: <RootErrorBoundary />,
  },
];

export default routes;
