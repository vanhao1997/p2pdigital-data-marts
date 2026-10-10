import { describe, expect, it } from 'vitest';
import { buildDocsUrl, docsPathForRoute, resolveDocsLocale } from './docs-links';

describe('contextual documentation links', () => {
  it.each([
    ['/ui/0/data-marts', 'getting-started/setup-guide/data-mart'],
    ['/ui/0/data-marts/42/insights', 'getting-started/setup-guide/insights'],
    ['/ui/0/data-marts/42/reports', 'getting-started/setup-guide/report-and-schedule'],
    ['/ui/0/data-storages', 'getting-started/setup-guide/storage'],
    ['/ui/0/data-destinations', 'getting-started/setup-guide/destination'],
    ['/ui/0/project-settings/members', 'project/members'],
    ['/ui/0/project-settings/contexts', 'project/contexts'],
    ['/ui/0/project-settings/notifications', 'notifications/notification-settings'],
    ['/ui/0/project-settings/variables', 'project-administration'],
    ['/ui/0/project-settings/mcp', 'getting-started/setup-guide/mcp'],
    ['/ui/0/project-settings/credit', 'getting-started/billing/consumption-units'],
    ['/ui/0/me/api-keys', 'api/api-keys'],
  ] as const)('maps %s to %s', (route, docsPath) => {
    expect(docsPathForRoute(route)).toBe(docsPath);
  });

  it('uses Vietnamese when available and an existing English page otherwise', () => {
    expect(resolveDocsLocale('vi-VN')).toBe('vi');
    expect(buildDocsUrl('getting-started/setup-guide/storage', 'vi', 'contextual_help')).toBe(
      'https://docs.p2pdigital.io.vn/vi/getting-started/setup-guide/storage/?utm_source=app_p2pdigital_vn&utm_medium=ui&utm_campaign=contextual_help'
    );
    expect(buildDocsUrl('getting-started/setup-guide/storage', 'en', 'contextual_help')).toBe(
      'https://docs.p2pdigital.io.vn/docs/storages/manage-storages/?utm_source=app_p2pdigital_vn&utm_medium=ui&utm_campaign=contextual_help'
    );
  });

  it('builds the Vietnamese billing link', () => {
    expect(buildDocsUrl('getting-started/billing/consumption-units', 'vi')).toContain(
      '/vi/getting-started/billing/consumption-units/'
    );
  });
});
