import { lazy, Suspense, type ReactNode } from 'react';
import type { RouteObject } from 'react-router';
import { LayoutErrorBoundary } from '../../components/errors';
import { InsightsV2Redirect } from './InsightsV2Redirect';
import { RouteLoading } from '../RouteLoading';

const DataMartOverviewContent = lazy(
  () => import('../../pages/data-marts/edit/DataMartOverviewContent')
);
const DataMartDataSetupContent = lazy(
  () => import('../../pages/data-marts/edit/DataMartDataSetupContent')
);
const DataMartQualityContent = lazy(
  () => import('../../pages/data-marts/edit/DataMartQualityContent')
);
const DataMartDestinationsContent = lazy(
  () => import('../../pages/data-marts/edit/DataMartDestinationsContent')
);
const DataMartRunHistoryContent = lazy(
  () => import('../../pages/data-marts/edit/DataMartRunHistoryContent')
);
const DataMartInsightsContent = lazy(
  () => import('../../pages/data-marts/edit/DataMartInsightsContent')
);
const DataMartNextInsightsContent = lazy(
  () => import('../../pages/data-marts/edit/DataMartNextInsightsContent')
);
const DataMartTriggersContent = lazy(
  () => import('../../pages/data-marts/edit/DataMartTriggersContent')
);
const PrevInsightsListView = lazy(
  () => import('../../features/data-marts/insights-prev/components/InsightsListView')
);
const PrevInsightDetailsView = lazy(
  () => import('../../features/data-marts/insights-prev/components/InsightDetailsView')
);
const InsightsListView = lazy(
  () => import('../../features/data-marts/insights/components/InsightsListView')
);
const InsightDetailsView = lazy(
  () => import('../../features/data-marts/insights/components/InsightDetailsView')
);

function lazyElement(element: ReactNode) {
  return <Suspense fallback={<RouteLoading />}>{element}</Suspense>;
}

export const dataMartDetailsRoutes: RouteObject[] = [
  {
    path: 'overview',
    element: lazyElement(<DataMartOverviewContent />),
    errorElement: <LayoutErrorBoundary />,
  },
  {
    path: 'data-setup',
    element: lazyElement(<DataMartDataSetupContent />),
    errorElement: <LayoutErrorBoundary />,
  },
  {
    path: 'quality',
    element: lazyElement(<DataMartQualityContent />),
    errorElement: <LayoutErrorBoundary />,
  },
  {
    path: 'insights',
    element: lazyElement(<DataMartNextInsightsContent />),
    errorElement: <LayoutErrorBoundary />,
    children: [
      { index: true, element: lazyElement(<InsightsListView />) },
      { path: ':insightId', element: lazyElement(<InsightDetailsView />) },
    ],
  },
  {
    path: 'insights-v2',
    element: <InsightsV2Redirect />,
    errorElement: <LayoutErrorBoundary />,
  },
  {
    path: 'insights-v2/:insightId',
    element: <InsightsV2Redirect />,
    errorElement: <LayoutErrorBoundary />,
  },
  {
    path: 'insights-legacy',
    element: lazyElement(<DataMartInsightsContent />),
    errorElement: <LayoutErrorBoundary />,
    children: [
      { index: true, element: lazyElement(<PrevInsightsListView />) },
      { path: ':insightId', element: lazyElement(<PrevInsightDetailsView />) },
    ],
  },
  {
    path: 'reports',
    element: lazyElement(<DataMartDestinationsContent />),
    errorElement: <LayoutErrorBoundary />,
  },
  {
    path: 'triggers',
    element: lazyElement(<DataMartTriggersContent />),
    errorElement: <LayoutErrorBoundary />,
  },
  {
    path: 'run-history',
    element: lazyElement(<DataMartRunHistoryContent />),
    errorElement: <LayoutErrorBoundary />,
  },
  {
    index: true,
    element: lazyElement(<DataMartOverviewContent />),
    errorElement: <LayoutErrorBoundary />,
  },
];
