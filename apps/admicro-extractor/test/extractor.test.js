import { describe, expect, it } from 'vitest';
import { buildReportUrl, validateRequest } from '../src/extractor.js';

const request = {
  reportType: 'campaign',
  platform: 'desktop',
  baseUrl: 'https://adx.admicro.vn',
  reportPath: '/vn/report/result',
  startDate: '2026-09-01',
  endDate: '2026-09-01',
  columnIds: ['1', '8', '2', '4', '5'],
  campaignIds: [],
  username: 'user',
  password: 'password',
};

describe('Admicro extractor request validation', () => {
  it('builds desktop and mobile report URLs', () => {
    const desktop = new URL(buildReportUrl(request));
    const mobile = new URL(buildReportUrl({ ...request, platform: 'mobile' }));

    expect(desktop.pathname).toBe('/vn/report/result');
    expect(desktop.searchParams.get('platform')).toBe('desktop');
    expect(mobile.pathname).toBe('/mobile/vn/report/result');
    expect(mobile.searchParams.has('platform')).toBe(false);
  });

  it('rejects report paths that can escape the Admicro origin', () => {
    expect(() => validateRequest({ ...request, reportPath: '/\\evil.example' })).toThrow(
      'ReportPath must be a relative absolute path'
    );
  });

  it('rejects non-Admicro base URLs', () => {
    expect(() => validateRequest({ ...request, baseUrl: 'https://example.com' })).toThrow(
      'BaseUrl must be an HTTPS admicro.vn host'
    );
  });

  it('rejects base URLs with embedded credentials or path segments', () => {
    expect(() =>
      validateRequest({ ...request, baseUrl: 'https://user:pass@adx.admicro.vn/vn' })
    ).toThrow('BaseUrl must be an HTTPS admicro.vn host');
  });

  it('rejects report paths with traversal segments', () => {
    expect(() => validateRequest({ ...request, reportPath: '/vn/../admin' })).toThrow(
      'ReportPath must be a relative absolute path'
    );
  });

  it('enforces the connector timezone contract', () => {
    expect(() => validateRequest({ ...request, timezone: 'UTC' })).toThrow(
      'timezone must be Asia/Ho_Chi_Minh'
    );
  });
});
