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
  | 'api/api-keys'
  | 'api/owox-ctl'
  | 'api/api-client'
  | 'api/openapi';

const DOCS_ORIGIN = 'https://docs.p2pdigital.io.vn/docs';
const VIETNAMESE_PATHS = new Set<DocsPath>([
  'getting-started/quick-start',
  'getting-started/core-concepts',
  'getting-started/setup-guide/data-mart',
  'getting-started/setup-guide/storage',
  'getting-started/setup-guide/destination',
  'getting-started/setup-guide/report-and-schedule',
  'getting-started/setup-guide/mcp',
  'getting-started/setup-guide/extension-data-marts',
  'api/api-keys',
]);

export function resolveDocsLocale(language: string | undefined): DocsLocale {
  return language?.toLowerCase().startsWith('vi') ? 'vi' : 'en';
}

/** Build the one canonical documentation URL used by app contextual help. */
export function buildDocsUrl(path: DocsPath, locale: DocsLocale, campaign = 'help_menu'): string {
  const normalizedPath = path.replace(/^\/+|\/+$/g, '');
  const localePrefix = locale === 'vi' && VIETNAMESE_PATHS.has(path) ? '/vi' : '';
  const url = new URL(`${DOCS_ORIGIN}${localePrefix}/${normalizedPath}/`);
  url.searchParams.set('utm_source', 'app_p2pdigital_vn');
  url.searchParams.set('utm_medium', 'ui');
  url.searchParams.set('utm_campaign', campaign);
  return url.toString();
}
