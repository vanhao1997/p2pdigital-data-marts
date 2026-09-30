import { lazy, Suspense, type ReactNode } from 'react';
import type { RouteObject } from 'react-router';
import { LayoutErrorBoundary } from '../../components/errors';
import { RouteLoading } from '../RouteLoading';

const MembersTab = lazy(() =>
  import('../../pages/project-settings/MembersTab').then(module => ({ default: module.MembersTab }))
);
const ContextsTab = lazy(() =>
  import('../../pages/project-settings/ContextsTab').then(module => ({
    default: module.ContextsTab,
  }))
);
const OverviewTab = lazy(() =>
  import('../../pages/project-settings/OverviewTab').then(module => ({
    default: module.OverviewTab,
  }))
);
const CreditConsumptionTab = lazy(() =>
  import('../../pages/project-settings/CreditConsumptionTab').then(module => ({
    default: module.CreditConsumptionTab,
  }))
);
const SubscriptionTab = lazy(() =>
  import('../../pages/project-settings/SubscriptionTab').then(module => ({
    default: module.SubscriptionTab,
  }))
);
const NotificationSettingsTab = lazy(() =>
  import('../../pages/project-settings/NotificationSettingsTab').then(module => ({
    default: module.NotificationSettingsTab,
  }))
);
const LicenseKeysTab = lazy(() =>
  import('../../pages/project-settings/LicenseKeysTab').then(module => ({
    default: module.LicenseKeysTab,
  }))
);
const VariablesTab = lazy(() =>
  import('../../pages/project-settings/VariablesTab').then(module => ({
    default: module.VariablesTab,
  }))
);

function lazyElement(element: ReactNode) {
  return <Suspense fallback={<RouteLoading />}>{element}</Suspense>;
}

export const projectSettingsRoutes: RouteObject[] = [
  {
    index: true,
    element: lazyElement(<OverviewTab />),
    errorElement: <LayoutErrorBoundary />,
  },
  {
    path: 'members',
    element: lazyElement(<MembersTab />),
    errorElement: <LayoutErrorBoundary />,
  },
  {
    path: 'contexts',
    element: lazyElement(<ContextsTab />),
    errorElement: <LayoutErrorBoundary />,
  },
  {
    path: 'credit',
    element: lazyElement(<CreditConsumptionTab />),
    errorElement: <LayoutErrorBoundary />,
  },
  {
    path: 'subscription',
    element: lazyElement(<SubscriptionTab />),
    errorElement: <LayoutErrorBoundary />,
  },
  {
    path: 'license-keys',
    element: lazyElement(<LicenseKeysTab />),
    errorElement: <LayoutErrorBoundary />,
  },
  {
    path: 'notifications',
    element: lazyElement(<NotificationSettingsTab />),
    errorElement: <LayoutErrorBoundary />,
  },
  {
    path: 'variables',
    element: lazyElement(<VariablesTab />),
    errorElement: <LayoutErrorBoundary />,
  },
];
