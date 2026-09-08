import { chromium, devices } from 'playwright';
import { parseDataview, normalizeCell, parseCampaignIds } from './parser.js';

const REPORT_TYPES = { campaign: 2, date: 3 };
const DEFAULT_COLUMNS = { desktop: ['1', '8', '2', '4', '5'], mobile: ['1', '9', '2', '4', '5'] };
const COLUMN_DESCRIPTORS = {
  1: { sourceKey: 'displayclick', label: 'Click', type: 'INTEGER' },
  2: { sourceKey: 'displayview', label: 'Impressions', type: 'INTEGER' },
  4: { sourceKey: 'ctr', label: 'CTR', type: 'NUMBER' },
  5: { sourceKey: 'money', label: 'Money', type: 'NUMBER' },
  8: { sourceKey: 'click', label: 'Total click', type: 'INTEGER' },
  9: { sourceKey: 'click', label: 'Total click', type: 'INTEGER' },
};
const MAX_CAMPAIGNS = 500;

function cleanPlatform(value) {
  const platform = String(value || 'desktop').toLowerCase();
  if (!['desktop', 'mobile'].includes(platform))
    throw errorWithStatus('Platform must be desktop or mobile', 400);
  return platform;
}

function isoDate(value, name) {
  const text = String(value || '');
  const parsed = new Date(`${text}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(text) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== text
  )
    throw errorWithStatus(`${name} must use YYYY-MM-DD`, 400);
  return text;
}

function reportPathForPlatform(reportPath, platform) {
  const path = String(reportPath || '/vn/report/result');
  let decodedPath = path;
  try {
    decodedPath = decodeURIComponent(path);
  } catch {
    throw errorWithStatus('ReportPath must be URI-decodable', 400);
  }
  if (/[?#]/.test(path) || /(^|\/)\.\.(\/|$)/.test(decodedPath) || path.includes('\\'))
    throw errorWithStatus('ReportPath must be a relative absolute path', 400);
  if (platform !== 'mobile' || path.startsWith('/mobile/')) return path;
  return `/mobile${path.startsWith('/') ? path : `/${path}`}`;
}

export function buildReportUrl(
  request,
  { startDate = request.startDate, endDate = request.endDate } = {}
) {
  const platform = cleanPlatform(request.platform);
  const baseUrl = new URL(request.baseUrl || 'https://adx.admicro.vn');
  const url = new URL(reportPathForPlatform(request.reportPath, platform), baseUrl);
  url.searchParams.set('sdate', isoDate(startDate, 'startDate'));
  url.searchParams.set('edate', isoDate(endDate || startDate, 'endDate'));
  url.searchParams.set(
    'type_report',
    String(REPORT_TYPES[request.reportType] || request.reportType)
  );
  url.searchParams.set('col_view', (request.columnIds || DEFAULT_COLUMNS[platform]).join(','));
  if (platform !== 'mobile') url.searchParams.set('platform', platform);
  if (request.campaignId) url.searchParams.set('lstid', request.campaignId);
  return url.toString();
}

async function findVisible(page, selectors) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) && (await locator.isVisible().catch(() => false))) return locator;
  }
  return null;
}

async function login(page, username, password) {
  const user = await findVisible(page, [
    'input[name="username"]',
    'input[name="user"]',
    'input[name="email"]',
    'input[type="email"]',
    '#username',
    '#email',
    'input[type="text"]',
  ]);
  const pass = await findVisible(page, [
    'input[name="password"]',
    'input[type="password"]',
    '#password',
  ]);
  if (!user || !pass) throw errorWithStatus('Could not find login form inputs on Admicro.', 502);
  await user.fill(username);
  await pass.fill(password);
  const submit = await findVisible(page, [
    'button[type="submit"]',
    'input[type="submit"]',
    'button:has-text("Login")',
    'button:has-text("Sign in")',
    'button:has-text("Dang nhap")',
    '.btn-login',
    '.login-btn',
  ]);
  if (submit)
    await Promise.all([page.waitForLoadState('networkidle').catch(() => {}), submit.click()]);
  else
    await Promise.all([
      page.waitForLoadState('networkidle').catch(() => {}),
      page.keyboard.press('Enter'),
    ]);
  await page.waitForTimeout(1500);
  if (
    isLoginPage(page.url()) ||
    ((await page.locator('input[type="password"]').count()) &&
      (await page
        .locator('input[type="password"]')
        .first()
        .isVisible()
        .catch(() => false)))
  )
    throw errorWithStatus('Admicro credentials were rejected.', 401);
}

function isLoginPage(url) {
  return /login|signin|dang-nhap|auth/i.test(url);
}

function isAllowedAdmicroUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      (url.hostname === 'admicro.vn' || url.hostname.endsWith('.admicro.vn'))
    );
  } catch {
    return false;
  }
}

async function hasKnownEmptyReport(page, reportType) {
  const selector = reportType === 'campaign' ? '#tbl_report_by_camp' : '#tbl_report_by_date';
  const table = page.locator(selector).first();
  if (!(await table.count())) return false;
  return (await page.locator(`${selector} tbody tr`).count()) === 0;
}

async function readDataview(page, reportType) {
  const names = ['DATAVIEW', 'dataView', 'dataview'];
  try {
    await page.waitForFunction(
      globals =>
        globals.some(name => {
          if (!/^[A-Za-z_$][\w$]*$/.test(name)) return false;
          let value = globalThis[name];
          if (value == null) {
            try {
              value = eval(name);
            } catch {
              return false;
            }
          }
          if (!value || typeof value !== 'object') return Boolean(value);
          const keys = Object.keys(value);
          return (
            keys.length > 0 && (keys.some(key => /data_|rpt|report/i.test(key)) || keys.length > 3)
          );
        }),
      names,
      { timeout: 45_000 }
    );
  } catch (error) {
    if (await hasKnownEmptyReport(page, reportType)) {
      return reportType === 'campaign' ? { data_rpt_campaign: [] } : { data_rpt_date: [] };
    }
    throw error;
  }
  return page.evaluate(globals => {
    const value = globals
      .map(name => {
        if (!/^[A-Za-z_$][\w$]*$/.test(name)) return undefined;
        if (globalThis[name] != null) return globalThis[name];
        try {
          return eval(name);
        } catch {
          return undefined;
        }
      })
      .find(item => {
        if (!item || typeof item !== 'object') return Boolean(item);
        const keys = Object.keys(item);
        return (
          keys.length > 0 && (keys.some(key => /data_|rpt|report/i.test(key)) || keys.length > 3)
        );
      });
    return JSON.parse(JSON.stringify(value));
  }, names);
}

function parseReportDay(value, fallback) {
  const text = String(value || '').trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const vietnameseMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (vietnameseMatch) return `${vietnameseMatch[3]}-${vietnameseMatch[2]}-${vietnameseMatch[1]}`;
  return fallback;
}

function findHeader(headers, candidates) {
  const normalizedCandidates = new Set(
    candidates.map(candidate => String(candidate).toLowerCase())
  );
  return headers.find(header => normalizedCandidates.has(String(header).toLowerCase()));
}

function metricSourceKeys(headers, reportType) {
  const dimensionKeys = new Set(
    reportType === 'campaign'
      ? ['key', 'camp_name', 'campaign_name', 'campaign_id', 'campaignid', 'camp_id']
      : ['key', 'date', 'day', 'report_date']
  );
  return headers.filter(header => !dimensionKeys.has(String(header).toLowerCase()));
}

function canonicalRows(parsed, request, campaignId) {
  const columns = request.columnIds || DEFAULT_COLUMNS[request.platform];
  const headers = parsed.headers;
  const metricKeys = metricSourceKeys(headers, request.reportType);
  const columnSources = columns.map((id, index) => {
    const descriptor = COLUMN_DESCRIPTORS[id];
    return findHeader(headers, descriptor ? [descriptor.sourceKey] : []) || metricKeys[index];
  });
  const rows = parsed.rows.map(row => {
    const source = Object.fromEntries(headers.map((header, index) => [header, row[index]]));
    const dimensionKey = findHeader(
      headers,
      request.reportType === 'campaign'
        ? ['key', 'campaign_id', 'campaignid', 'camp_id']
        : ['key', 'date', 'day', 'report_date']
    );
    const returnedDimension = dimensionKey ? source[dimensionKey] : null;
    const day =
      request.reportType === 'date'
        ? parseReportDay(returnedDimension, request.startDate)
        : request.startDate;
    const result = {
      day,
      platform: request.platform,
      report_type: request.reportType,
      campaign_scope: campaignId || 'all',
    };
    if (request.reportType === 'date') result.date = day;
    columns.forEach((id, index) => {
      const sourceKey = columnSources[index];
      result[`admicro_column_${id}`] = normalizeCell(sourceKey ? source[sourceKey] : null, {
        decimal: COLUMN_DESCRIPTORS[id]?.sourceKey === 'ctr',
      });
    });
    if (request.reportType === 'campaign')
      result.campaign_id =
        normalizeCell(returnedDimension, { identifier: true }) || campaignId || null;
    return result;
  });
  const deduplicatedRows = uniqueRows(rows);
  const fields = {};
  columns.forEach((id, index) => {
    const name = `admicro_column_${id}`;
    const values = deduplicatedRows
      .map(row => row[name])
      .filter(value => value !== null && value !== undefined);
    const inferredType =
      values.length && values.every(Number.isInteger)
        ? 'INTEGER'
        : values.length && values.every(value => typeof value === 'number')
          ? 'NUMBER'
          : 'STRING';
    const descriptor = COLUMN_DESCRIPTORS[id];
    const sourceKey = columnSources[index] || descriptor?.sourceKey || `Column ${index + 1}`;
    fields[name] = {
      type: values.length ? inferredType : descriptor?.type || inferredType,
      label: descriptor?.label || sourceKey,
      description: `Admicro column ${id} (${String(sourceKey).replace(/[\r\n]+/g, ' ')}). Value returned by Admicro; grain is daily ${request.reportType}.`,
      sourceColumnId: id,
      sourceKey,
      formula: 'Value returned by Admicro',
      grain:
        request.reportType === 'campaign'
          ? 'day + campaign + platform + scope'
          : 'day + platform + scope',
      timezone: 'Asia/Ho_Chi_Minh',
      syncFrequency: 'daily',
      lookbackDays: 7,
    };
  });
  return { fields, rows: deduplicatedRows };
}

function uniqueRows(rows) {
  const seen = new Set();
  return rows.filter(row => {
    const key = JSON.stringify(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildFieldSchema(
  columnIds = DEFAULT_COLUMNS.desktop,
  discoveredFields = {},
  reportType = 'campaign'
) {
  const fields = {
    day: { type: 'DATE', label: 'Day', description: 'Admicro report day in Asia/Ho_Chi_Minh.' },
    platform: {
      type: 'STRING',
      label: 'Platform',
      description: 'Admicro report platform: desktop or mobile.',
    },
    report_type: { type: 'STRING', label: 'Report type', description: 'Admicro report node.' },
    campaign_scope: {
      type: 'STRING',
      label: 'Campaign scope',
      description: 'all or requested campaign ID.',
    },
    campaign_id: {
      type: 'STRING',
      label: 'Campaign ID',
      description: 'Campaign identifier when returned by Admicro.',
    },
  };
  if (reportType === 'date') {
    delete fields.campaign_id;
    fields.date = {
      type: 'DATE',
      label: 'Date',
      description: 'Date dimension returned by the Admicro date report.',
    };
  }
  for (const id of columnIds) {
    const name = `admicro_column_${id}`;
    const descriptor = COLUMN_DESCRIPTORS[id];
    fields[name] = discoveredFields[name] || {
      type: descriptor?.type || 'STRING',
      label: descriptor?.label || `Admicro column ${id}`,
      description: descriptor
        ? `Admicro column ${id} (${descriptor.sourceKey}). Value returned by Admicro.`
        : `Admicro source column ${id}; provider type is not mapped.`,
      sourceColumnId: id,
      sourceKey: descriptor?.sourceKey,
      formula: 'Value returned by Admicro',
      timezone: 'Asia/Ho_Chi_Minh',
      syncFrequency: 'daily',
      lookbackDays: 7,
    };
  }
  return fields;
}

function errorWithStatus(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function validateRequest(input, { requireCredentials = true } = {}) {
  const request = { ...input };
  if (!request.reportType || !REPORT_TYPES[request.reportType])
    throw errorWithStatus('reportType must be campaign or date', 400);
  request.platform = cleanPlatform(request.platform);
  request.startDate = isoDate(request.startDate, 'startDate');
  request.endDate = isoDate(request.endDate || request.startDate, 'endDate');
  if (request.endDate < request.startDate)
    throw errorWithStatus('endDate cannot be earlier than startDate', 400);
  request.columnIds = [
    ...new Set(
      (Array.isArray(request.columnIds) && request.columnIds.length
        ? request.columnIds
        : DEFAULT_COLUMNS[request.platform]
      ).map(String)
    ),
  ];
  if (request.columnIds.length > 100) throw errorWithStatus('columnIds exceeds 100 columns', 400);
  if (request.columnIds.some(id => !/^\d+$/.test(id)))
    throw errorWithStatus('columnIds must contain numeric IDs', 400);
  request.campaignIds = parseCampaignIds(request.campaignIds);
  if (request.campaignIds.length > MAX_CAMPAIGNS)
    throw errorWithStatus('campaignIds exceeds 500 campaigns', 400);
  if (request.campaignIds.some(id => !/^\d+$/.test(id)))
    throw errorWithStatus('campaignIds must contain numeric IDs', 400);
  request.timezone = String(request.timezone || 'Asia/Ho_Chi_Minh');
  if (request.timezone !== 'Asia/Ho_Chi_Minh')
    throw errorWithStatus('timezone must be Asia/Ho_Chi_Minh', 400);
  let baseUrl;
  try {
    baseUrl = new URL(request.baseUrl || 'https://adx.admicro.vn');
  } catch {
    throw errorWithStatus('BaseUrl must be a valid URL', 400);
  }
  if (
    baseUrl.protocol !== 'https:' ||
    baseUrl.username ||
    baseUrl.password ||
    baseUrl.pathname !== '/' ||
    baseUrl.search ||
    baseUrl.hash ||
    (baseUrl.hostname !== 'admicro.vn' && !baseUrl.hostname.endsWith('.admicro.vn'))
  ) {
    throw errorWithStatus('BaseUrl must be an HTTPS admicro.vn host', 400);
  }
  request.baseUrl = baseUrl.origin;
  request.reportPath = String(request.reportPath || '/vn/report/result');
  if (
    !request.reportPath.startsWith('/') ||
    request.reportPath.startsWith('//') ||
    request.reportPath.includes('\\')
  )
    throw errorWithStatus('ReportPath must be a relative absolute path', 400);
  reportPathForPlatform(request.reportPath, request.platform);
  if (requireCredentials && (!request.username || !request.password))
    throw errorWithStatus('Admicro username and password are required', 400);
  return request;
}

export async function extract(
  request,
  {
    signal,
    log = () => {},
    onBrowserStarted = () => {},
    onBrowserStartFailed = () => {},
    onBrowserClosed = () => {},
  } = {}
) {
  signal?.throwIfAborted();
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    onBrowserStarted();
  } catch (error) {
    onBrowserStartFailed();
    throw error;
  }
  let context;
  const results = [];
  const discoveredFields = {};
  let browserClosed = false;
  const closeBrowser = async () => {
    if (browserClosed) return;
    browserClosed = true;
    await browser.close().catch(() => {});
  };
  const onAbort = () => void closeBrowser();
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    context = await browser.newContext(
      request.platform === 'mobile'
        ? { ...devices['iPhone 13'] }
        : { viewport: { width: 1440, height: 900 } }
    );
    context.setDefaultTimeout(45_000);
    context.setDefaultNavigationTimeout(60_000);

    const campaigns = request.campaignIds.length ? request.campaignIds : [null];
    for (const campaignId of campaigns) {
      let page;
      try {
        signal?.throwIfAborted();
        page = await context.newPage();
        await page.route('**/*', async route => {
          const browserRequest = route.request();
          const isTopLevelNavigation =
            browserRequest.isNavigationRequest() && browserRequest.frame() === page.mainFrame();
          if (isTopLevelNavigation && !isAllowedAdmicroUrl(browserRequest.url())) {
            return route.abort('blockedbyclient');
          }
          return route.continue();
        });

        const scopedUrl = buildReportUrl(campaignId ? { ...request, campaignId } : request, {
          startDate: request.startDate,
          endDate: request.endDate,
        });
        log(`Opening Admicro ${request.reportType} report for ${campaignId || 'all campaigns'}.`);
        await page.goto(scopedUrl, { waitUntil: 'domcontentloaded' });
        const passwordInput = page.locator('input[type="password"]').first();
        const hasVisiblePasswordInput =
          (await passwordInput.count()) > 0 && (await passwordInput.isVisible().catch(() => false));
        if (isLoginPage(page.url()) || hasVisiblePasswordInput) {
          await login(page, request.username, request.password);
          await page.goto(scopedUrl, { waitUntil: 'domcontentloaded' });
        }
        await page.waitForLoadState('networkidle').catch(() => {});
        const dataview = await readDataview(page, request.reportType);
        const parsed = parseDataview(dataview, request.reportType);
        signal?.throwIfAborted();
        const canonical = canonicalRows(parsed, request, campaignId);
        results.push(...canonical.rows);
        Object.assign(discoveredFields, canonical.fields);
      } finally {
        await page?.close().catch(() => {});
      }
    }
    return {
      rows: uniqueRows(results),
      fields: buildFieldSchema(request.columnIds, discoveredFields, request.reportType),
    };
  } finally {
    signal?.removeEventListener('abort', onAbort);
    await context?.close().catch(() => {});
    await closeBrowser();
    onBrowserClosed();
  }
}
