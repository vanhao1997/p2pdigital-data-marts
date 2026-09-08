import express from 'express';
import { extract, validateRequest } from './extractor.js';
import { jobLogContext, writeOperationalLog } from './operational-log.js';
import { createReplayStoreFromEnv } from './replay-store.js';
import { verifyHmac } from './security.js';
import * as metrics from './metrics.js';

const app = express();
const port = Number(process.env.PORT || 8091);
const listenHost = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1';
const sharedSecret = process.env.ADMICRO_EXTRACTOR_SHARED_SECRET || '';
const enabled =
  String(process.env.ADMICRO_EXTRACTOR_ENABLED || 'true')
    .trim()
    .toLowerCase() !== 'false';
const maxBodyBytes = 512 * 1024;
const configuredConcurrency = Number(process.env.ADMICRO_EXTRACTOR_MAX_CONCURRENCY || 2);
const maxConcurrentJobs =
    Number.isInteger(configuredConcurrency) && configuredConcurrency > 0
      ? Math.min(configuredConcurrency, 100)
      : 2;
const replayStore = createReplayStoreFromEnv();
let activeJobs = 0;

app.use(
  express.json({
    limit: maxBodyBytes,
    verify: (req, _res, buffer) => {
      req.rawBody = buffer.toString('utf8');
    },
  })
);

app.get('/healthz', async (_req, res) => {
  const replayHealth =
    enabled && sharedSecret
      ? await replayStore.health()
      : { ok: true, mode: replayStore.mode, shared: replayStore.shared };
  const healthy = !enabled || (Boolean(sharedSecret) && replayHealth.ok);
  return res.status(healthy ? 200 : 503).json({
    ok: healthy,
    enabled,
    service: 'admicro-extractor',
    schemaVersion: '1',
    hmacConfigured: Boolean(sharedSecret),
    nonceStore: replayHealth.mode,
    replayStoreHealthy: replayHealth.ok,
    sharedReplayProtection: replayHealth.shared,
  });
});

app.get('/metrics', (_req, res) => {
  res.type('text/plain').send(metrics.renderPrometheus());
});

function requireEnabled(req, res, next) {
  if (!enabled) return res.status(503).json({ error: 'Admicro extractor is disabled' });
  return next();
}

async function requireHmac(req, res, next) {
  const result = await verifyHmac(req, req.rawBody || '', sharedSecret, replayStore);
  if (!result.ok) return res.status(result.status).json({ error: result.message });
  return next();
}

function failureType(status) {
  if (status === 401) return 'authentication';
  if (status === 400) return 'validation';
  if (status === 429) return 'rate_limit';
  return 'provider';
}

function publicErrorMessage(error, status, fallback) {
  if (![400, 401, 429].includes(status)) return fallback;
  const message = error instanceof Error ? error.message : fallback;
  return String(message || fallback)
    .replace(
      /(access[_ -]?token|client[_ -]?secret|app[_ -]?secret|username|password|cookie|authorization)\s*[:=]\s*\S+/gi,
      '$1=[REDACTED]'
    )
    .replace(/\bBearer\s+[A-Za-z0-9._-]+\b/gi, 'Bearer [REDACTED]')
    .replace(/\bEA[A-Za-z0-9_-]{20,}\b/g, '[REDACTED_TOKEN]')
    .replace(/\bact_[^\s;)]+\b/gi, '[REDACTED_ACCOUNT]')
    .replace(/\b\d{6,}\b/g, '[REDACTED_ID]')
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[REDACTED_EMAIL]');
}

app.post('/v1/preview', requireEnabled, requireHmac, async (req, res) => {
  const startedAt = Date.now();
  const logContext = jobLogContext(req, { reportType: 'campaign' });
  if (activeJobs >= maxConcurrentJobs) {
    metrics.recordJob({ operation: 'preview', reportType: logContext.reportType, platform: logContext.platform, status: 'rejected', errorType: 'rate_limit' });
    writeOperationalLog('warn', 'job_rejected', {
      operation: 'preview',
      ...logContext,
      status: 'rejected',
      statusCode: 429,
      activeJobs,
      maxConcurrentJobs,
    });
    return res.status(429).json({ error: 'Admicro extractor concurrency limit reached' });
  }
  activeJobs += 1;
  metrics.setActiveJobs(activeJobs);
  const abortController = new AbortController();
  const abort = () => abortController.abort(new Error('Client disconnected'));
  const abortOnClose = () => {
    if (!res.writableEnded) abort();
  };
  req.once('aborted', abort);
  res.once('close', abortOnClose);
  try {
    const request = validateRequest({ ...req.body, reportType: req.body.reportType || 'campaign' });
    const result = await extract(request, {
      signal: abortController.signal,
      onBrowserStarted: metrics.recordBrowserLaunch,
      onBrowserStartFailed: metrics.recordBrowserLaunchFailure,
      onBrowserClosed: metrics.recordBrowserClose,
    });
    metrics.recordJob({ operation: 'preview', ...logContext, status: 'success', durationMs: Date.now() - startedAt });
    writeOperationalLog('info', 'job_completed', {
      operation: 'preview',
      ...logContext,
      status: 'success',
      statusCode: 200,
      rowCount: result.rows.length,
      durationMs: Date.now() - startedAt,
    });
    return res.json({
      schemaVersion: '1',
      reportType: request.reportType,
      platform: request.platform,
      fields: result.fields,
      requestedColumnIds: request.columnIds,
    });
  } catch (error) {
    if (abortController.signal.aborted) {
      metrics.recordJob({ operation: 'preview', ...logContext, status: 'cancelled', durationMs: Date.now() - startedAt });
      writeOperationalLog('info', 'job_cancelled', {
        operation: 'preview',
        ...logContext,
        status: 'cancelled',
        statusCode: 499,
        durationMs: Date.now() - startedAt,
      });
      return;
    }
    const status = [400, 401, 429].includes(error?.statusCode) ? error.statusCode : 502;
    metrics.recordJob({ operation: 'preview', ...logContext, status: 'failed', errorType: failureType(status), durationMs: Date.now() - startedAt });
    writeOperationalLog(status >= 500 ? 'error' : 'warn', 'job_failed', {
      operation: 'preview',
      ...logContext,
      status: 'failed',
      statusCode: status,
      errorType: failureType(status),
      durationMs: Date.now() - startedAt,
    });
    return res
      .status(status)
      .json({ error: publicErrorMessage(error, status, 'Admicro preview failed') });
  } finally {
    activeJobs -= 1;
    metrics.setActiveJobs(activeJobs);
    req.removeListener('aborted', abort);
    res.removeListener('close', abortOnClose);
  }
});

app.post('/v1/extract', requireEnabled, requireHmac, async (req, res) => {
  const startedAt = Date.now();
  const logContext = jobLogContext(req);
  if (activeJobs >= maxConcurrentJobs) {
    metrics.recordJob({ operation: 'extract', reportType: logContext.reportType, platform: logContext.platform, status: 'rejected', errorType: 'rate_limit' });
    writeOperationalLog('warn', 'job_rejected', {
      operation: 'extract',
      ...logContext,
      status: 'rejected',
      statusCode: 429,
      activeJobs,
      maxConcurrentJobs,
    });
    return res.status(429).json({ error: 'Admicro extractor concurrency limit reached' });
  }
  activeJobs += 1;
  metrics.setActiveJobs(activeJobs);
  const abortController = new AbortController();
  const abort = () => abortController.abort(new Error('Client disconnected'));
  const abortOnClose = () => {
    if (!res.writableEnded) abort();
  };
  req.once('aborted', abort);
  res.once('close', abortOnClose);
  try {
    const request = validateRequest(req.body);
    const result = await extract(request, {
      signal: abortController.signal,
      onBrowserStarted: metrics.recordBrowserLaunch,
      onBrowserStartFailed: metrics.recordBrowserLaunchFailure,
      onBrowserClosed: metrics.recordBrowserClose,
    });
    metrics.recordJob({ operation: 'extract', ...logContext, status: 'success', durationMs: Date.now() - startedAt });
    const durationMs = Date.now() - startedAt;
    writeOperationalLog('info', 'job_completed', {
      operation: 'extract',
      ...logContext,
      status: 'success',
      statusCode: 200,
      rowCount: result.rows.length,
      durationMs,
    });
    return res.json({
      schemaVersion: '1',
      fields: result.fields,
      rows: result.rows,
      reportType: request.reportType,
      platform: request.platform,
      dateRange: {
        startDate: request.startDate,
        endDate: request.endDate,
        timezone: request.timezone,
      },
      campaignScope: request.campaignIds.length ? request.campaignIds : ['all'],
      parserVersion: '1.1.0',
      fetchedAt: new Date().toISOString(),
      requestedColumnIds: request.columnIds,
      rowCount: result.rows.length,
      durationMs,
    });
  } catch (error) {
    if (abortController.signal.aborted) {
      metrics.recordJob({ operation: 'extract', ...logContext, status: 'cancelled', durationMs: Date.now() - startedAt });
      writeOperationalLog('info', 'job_cancelled', {
        operation: 'extract',
        ...logContext,
        status: 'cancelled',
        statusCode: 499,
        durationMs: Date.now() - startedAt,
      });
      return;
    }
    const status = [400, 401, 429].includes(error?.statusCode) ? error.statusCode : 502;
    metrics.recordJob({ operation: 'extract', ...logContext, status: 'failed', errorType: failureType(status), durationMs: Date.now() - startedAt });
    writeOperationalLog(status >= 500 ? 'error' : 'warn', 'job_failed', {
      operation: 'extract',
      ...logContext,
      status: 'failed',
      statusCode: status,
      errorType: failureType(status),
      durationMs: Date.now() - startedAt,
    });
    return res
      .status(status)
      .json({ error: publicErrorMessage(error, status, 'Admicro extraction failed') });
  } finally {
    activeJobs -= 1;
    metrics.setActiveJobs(activeJobs);
    req.removeListener('aborted', abort);
    res.removeListener('close', abortOnClose);
  }
});

app.use((error, _req, res, _next) => {
  if (error?.type === 'entity.too.large')
    return res.status(413).json({ error: 'Request payload exceeds 512 KB' });
  return res.status(400).json({ error: 'Invalid JSON request' });
});

export { app, listenHost };

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, listenHost, () =>
    console.log(`Admicro extractor listening on ${listenHost}:${port}`)
  );
  process.once('SIGTERM', () => void replayStore.close());
  process.once('SIGINT', () => void replayStore.close());
}
