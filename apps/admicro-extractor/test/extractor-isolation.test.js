import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const campaignFixture = JSON.parse(
  readFileSync(new URL('./fixtures/campaign-dataview.json', import.meta.url), 'utf8')
);
const dateFixture = JSON.parse(
  readFileSync(new URL('./fixtures/date-dataview.json', import.meta.url), 'utf8')
);

const playwrightMocks = vi.hoisted(() => ({
  browserClose: vi.fn().mockResolvedValue(undefined),
  contextClose: vi.fn().mockResolvedValue(undefined),
  pageClose: vi.fn().mockResolvedValue(undefined),
  newPage: vi.fn(),
  newContext: vi.fn(),
  waitForFunction: vi.fn(async () => undefined),
  dataview: { current: null },
  emptyReport: { current: false },
}));

vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn(async () => ({
      close: playwrightMocks.browserClose,
      newContext: playwrightMocks.newContext,
    })),
  },
  devices: { 'iPhone 13': {} },
}));

import { extract } from '../src/extractor.js';

describe('Admicro campaign scope isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    playwrightMocks.dataview.current = campaignFixture;
    playwrightMocks.emptyReport.current = false;
    playwrightMocks.newPage.mockImplementation(async () => {
      const page = {
        close: playwrightMocks.pageClose,
        evaluate: vi.fn(async () => playwrightMocks.dataview.current),
        goto: vi.fn(async () => undefined),
        locator: vi.fn(selector => {
          const isReportTable = ['#tbl_report_by_camp', '#tbl_report_by_date'].includes(selector);
          const count = playwrightMocks.emptyReport.current && isReportTable ? 1 : 0;
          return {
            count: vi.fn(async () => count),
            first: vi.fn(() => ({
              count: vi.fn(async () => count),
              isVisible: vi.fn(async () => false),
            })),
          };
        }),
        mainFrame: vi.fn(() => ({})),
        route: vi.fn(async () => undefined),
        url: vi.fn(() => 'https://adx.admicro.vn/vn/report/result'),
        waitForFunction: playwrightMocks.waitForFunction,
        waitForLoadState: vi.fn(async () => undefined),
      };
      return page;
    });
    playwrightMocks.newContext.mockResolvedValue({
      close: playwrightMocks.contextClose,
      newPage: playwrightMocks.newPage,
      setDefaultNavigationTimeout: vi.fn(),
      setDefaultTimeout: vi.fn(),
    });
  });

  it('uses one ephemeral browser context while processing campaign scopes sequentially', async () => {
    const result = await extract({
      reportType: 'campaign',
      platform: 'desktop',
      baseUrl: 'https://adx.admicro.vn',
      reportPath: '/vn/report/result',
      startDate: '2026-09-01',
      endDate: '2026-09-01',
      columnIds: ['1', '8', '2', '4', '5'],
      campaignIds: ['101', '202'],
      username: 'user',
      password: 'password',
    });

    expect(playwrightMocks.newContext).toHaveBeenCalledTimes(1);
    expect(playwrightMocks.newPage).toHaveBeenCalledTimes(2);
    expect(playwrightMocks.contextClose).toHaveBeenCalledTimes(1);
    expect(playwrightMocks.pageClose).toHaveBeenCalledTimes(2);
    expect(result.rows.map(row => row.campaign_scope)).toEqual(['101', '101', '202', '202']);
    expect(result.rows[0]).toMatchObject({
      day: '2026-09-01',
      platform: 'desktop',
      report_type: 'campaign',
      campaign_id: 'campaign_1001',
      admicro_column_1: 1234,
      admicro_column_8: 4567,
      admicro_column_2: 2345678,
      admicro_column_4: 0.052,
      admicro_column_5: 20000000,
    });
    expect(result.fields.admicro_column_8).toMatchObject({
      sourceColumnId: '8',
      formula: 'Value returned by Admicro',
      grain: 'day + campaign + platform + scope',
      timezone: 'Asia/Ho_Chi_Minh',
      syncFrequency: 'daily',
      lookbackDays: 7,
    });
  });

  it('produces canonical date rows from a sanitized DATAVIEW fixture', async () => {
    playwrightMocks.dataview.current = dateFixture;

    const result = await extract({
      reportType: 'date',
      platform: 'desktop',
      baseUrl: 'https://adx.admicro.vn',
      reportPath: '/vn/report/result',
      startDate: '2026-09-01',
      endDate: '2026-09-01',
      columnIds: ['1', '8', '2', '4', '5'],
      campaignIds: [],
      username: 'user',
      password: 'password',
    });

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual({
      day: '2026-07-01',
      date: '2026-07-01',
      platform: 'desktop',
      report_type: 'date',
      campaign_scope: 'all',
      admicro_column_1: 10,
      admicro_column_8: 20,
      admicro_column_2: 30000,
      admicro_column_4: 0.033,
      admicro_column_5: 300000,
    });
    expect(result.fields).not.toHaveProperty('campaign_id');
    expect(result.fields).toHaveProperty('date');
  });

  it('returns a successful empty result when Admicro omits DATAVIEW for an empty report', async () => {
    playwrightMocks.emptyReport.current = true;
    playwrightMocks.waitForFunction.mockRejectedValueOnce(new Error('Timeout'));

    const result = await extract({
      reportType: 'campaign',
      platform: 'mobile',
      baseUrl: 'https://adx.admicro.vn',
      reportPath: '/vn/report/result',
      startDate: '2026-09-01',
      endDate: '2026-09-01',
      columnIds: ['1', '9', '2', '4', '5'],
      campaignIds: [],
      username: 'user',
      password: 'password',
    });

    expect(result.rows).toEqual([]);
    expect(result.fields).toHaveProperty('admicro_column_9');
    expect(result.fields.admicro_column_9).toMatchObject({
      type: 'INTEGER',
      label: 'Total click',
      sourceKey: 'click',
    });
    expect(playwrightMocks.waitForFunction).toHaveBeenCalledOnce();
  });

  it('closes the page, context, and browser when a job is cancelled', async () => {
    const controller = new AbortController();
    let rejectDataview;
    playwrightMocks.waitForFunction.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectDataview = reject;
        })
    );
    playwrightMocks.browserClose.mockImplementation(async () => {
      rejectDataview?.(new Error('Browser closed after cancellation'));
    });

    const extraction = extract(
      {
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
      },
      { signal: controller.signal }
    );

    await vi.waitFor(() => expect(playwrightMocks.waitForFunction).toHaveBeenCalledOnce());
    controller.abort();

    await expect(extraction).rejects.toThrow('Browser closed after cancellation');
    expect(playwrightMocks.pageClose).toHaveBeenCalledOnce();
    expect(playwrightMocks.contextClose).toHaveBeenCalledOnce();
    expect(playwrightMocks.browserClose).toHaveBeenCalledOnce();
  });

  it('does not launch Chromium when cancellation is already requested', async () => {
    const controller = new AbortController();
    controller.abort(new Error('already cancelled'));

    await expect(
      extract(
        {
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
        },
        { signal: controller.signal }
      )
    ).rejects.toThrow('already cancelled');

    expect(chromium.launch).not.toHaveBeenCalled();
  });
});
