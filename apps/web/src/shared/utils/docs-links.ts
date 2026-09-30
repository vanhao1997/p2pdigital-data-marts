export type DocsLocale = 'vi' | 'en';

export type DocsPath =
  | 'changelog'
  | 'getting-started/quick-start'
  | 'getting-started/core-concepts'
  | 'getting-started/setup-guide/data-mart'
  | 'getting-started/setup-guide/storage'
  | 'getting-started/setup-guide/destination'
  | 'getting-started/setup-guide/report-and-schedule'
  | 'getting-started/setup-guide/mcp'
  | 'getting-started/setup-guide/extension-data-marts'
  | 'getting-started/setup-guide/connector-data-mart'
  | 'getting-started/setup-guide/insights'
  | 'getting-started/billing/consumption-units'
  | 'getting-started/setup-guide/models-canvas-export'
  | 'project/members'
  | 'project/contexts'
  | 'project/roles-and-permissions'
  | 'project-administration'
  | 'notifications/notification-settings'
  | 'api/api-keys'
  | 'api/owox-ctl'
  | 'api/api-client'
  | 'api/openapi';

const DOCS_ORIGIN = 'https://docs.p2pdigital.io.vn';
const VIETNAMESE_PATHS = new Set<DocsPath>([
  'getting-started/quick-start',
  'getting-started/core-concepts',
  'getting-started/setup-guide/data-mart',
  'getting-started/setup-guide/storage',
  'getting-started/setup-guide/destination',
  'getting-started/setup-guide/report-and-schedule',
  'getting-started/setup-guide/mcp',
  'getting-started/setup-guide/extension-data-marts',
  'getting-started/setup-guide/connector-data-mart',
  'getting-started/setup-guide/insights',
  'getting-started/billing/consumption-units',
  'project/members',
  'project/contexts',
  'project/roles-and-permissions',
  'project-administration',
  'notifications/notification-settings',
  'api/api-keys',
]);

const ENGLISH_PATH_FALLBACKS: Partial<Record<DocsPath, string>> = {
  'getting-started/setup-guide/data-mart': 'getting-started/setup-guide/connector-data-mart',
  'getting-started/setup-guide/storage': 'storages/manage-storages',
  'getting-started/setup-guide/destination': 'destinations/manage-destinations',
  'getting-started/setup-guide/report-and-schedule': 'getting-started/setup-guide/report-triggers',
};

/** Resolve the closest user guide from the active project route. */
export function docsPathForRoute(pathname: string): DocsPath {
  const projectRouteMatch = /^\/ui\/[^/]+\/(.*)$/.exec(pathname);
  const projectRoute = projectRouteMatch?.[1] ?? '';
  if (projectRoute.startsWith('project-settings/members')) return 'project/members';
  if (projectRoute.startsWith('project-settings/contexts')) return 'project/contexts';
  if (projectRoute.startsWith('project-settings/notifications')) {
    return 'notifications/notification-settings';
  }
  if (projectRoute.startsWith('project-settings/variables')) return 'project-administration';
  if (projectRoute.startsWith('project-settings/credit')) {
    return 'getting-started/billing/consumption-units';
  }
  if (projectRoute.startsWith('project-settings')) return 'project/roles-and-permissions';
  if (projectRoute.startsWith('me/api-keys')) return 'api/api-keys';
  if (projectRoute.startsWith('notifications')) return 'notifications/notification-settings';
  if (projectRoute.startsWith('data-storages')) return 'getting-started/setup-guide/storage';
  if (projectRoute.startsWith('data-destinations'))
    return 'getting-started/setup-guide/destination';
  if (projectRoute.startsWith('data-marts/models')) {
    return 'getting-started/setup-guide/models-canvas-export';
  }
  if (projectRoute.includes('/insights') || projectRoute.startsWith('data-marts/insights')) {
    return 'getting-started/setup-guide/insights';
  }
  if (projectRoute.includes('/reports') || projectRoute.startsWith('data-marts/reports')) {
    return 'getting-started/setup-guide/report-and-schedule';
  }
  if (projectRoute.startsWith('data-marts')) return 'getting-started/setup-guide/data-mart';
  return 'getting-started/quick-start';
}

export function resolveDocsLocale(language: string | undefined): DocsLocale {
  return language?.toLowerCase().startsWith('vi') ? 'vi' : 'en';
}

/** Build the one canonical documentation URL used by app contextual help. */
export function buildDocsUrl(path: DocsPath, locale: DocsLocale, campaign = 'help_menu'): string {
  const useVietnamese = locale === 'vi' && VIETNAMESE_PATHS.has(path);
  const resolvedPath = useVietnamese ? path : (ENGLISH_PATH_FALLBACKS[path] ?? path);
  const normalizedPath = resolvedPath.replace(/^\/+|\/+$/g, '');
  // The docs site keeps English under `/docs` and Vietnamese under `/vi`.
  // They are separate route namespaces; `/docs/vi` is a 404.
  const localePrefix = useVietnamese ? '/vi' : '/docs';
  const url = new URL(`${DOCS_ORIGIN}${localePrefix}/${normalizedPath}/`);
  url.searchParams.set('utm_source', 'app_p2pdigital_vn');
  url.searchParams.set('utm_medium', 'ui');
  url.searchParams.set('utm_campaign', campaign);
  return url.toString();
}
