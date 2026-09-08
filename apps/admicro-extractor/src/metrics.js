const HISTOGRAM_BUCKETS = [100, 500, 1000, 5000, 15000, 30000, 60000];
const ALLOWED_OPERATIONS = new Set(['preview', 'extract']);
const ALLOWED_STATUSES = new Set(['success', 'failed', 'cancelled', 'rejected']);
const ALLOWED_ERROR_TYPES = new Set(['authentication', 'validation', 'rate_limit', 'provider']);

const state = {
  jobs: new Map(),
  retryAttempts: 0,
  durations: new Map(),
  browserLaunches: 0,
  browserLaunchFailures: 0,
  browserCloses: 0,
  activeBrowsers: 0,
  activeJobs: 0,
};

function normalized(value, allowed, fallback) {
  const normalizedValue = String(value || '').trim();
  return allowed.has(normalizedValue) ? normalizedValue : fallback;
}

function labelKey({ operation, report_type, platform, status, error_type }) {
  return [operation, report_type, platform, status, error_type].join('|');
}

function labels({ operation, reportType, platform, status, errorType }) {
  return {
    operation: normalized(operation, ALLOWED_OPERATIONS, 'unknown'),
    report_type: reportType === 'campaign' || reportType === 'date' ? reportType : 'unknown',
    platform: platform === 'desktop' || platform === 'mobile' ? platform : 'unknown',
    status: normalized(status, ALLOWED_STATUSES, 'failed'),
    error_type: normalized(errorType, ALLOWED_ERROR_TYPES, 'provider'),
  };
}

function labelsText(values) {
  return Object.entries(values)
    .map(([key, value]) => `${key}="${String(value).replaceAll('"', '\\"')}"`)
    .join(',');
}

function isRetryAttempt(attempt, retryCount) {
  const attemptValue = Number(attempt);
  if (Number.isInteger(attemptValue) && attemptValue >= 1 && attemptValue <= 100) {
    return attemptValue > 1;
  }

  const retryCountValue = Number(retryCount);
  if (Number.isInteger(retryCountValue) && retryCountValue >= 0 && retryCountValue <= 99) {
    return retryCountValue > 0;
  }

  return false;
}

export function recordJob({
  operation,
  reportType,
  platform,
  status,
  errorType,
  attempt,
  retryCount,
  durationMs = 0,
}) {
  const values = labels({ operation, reportType, platform, status, errorType });
  const key = labelKey(values);
  state.jobs.set(key, (state.jobs.get(key) || 0) + 1);
  if (isRetryAttempt(attempt, retryCount)) state.retryAttempts += 1;
  const duration = Number.isFinite(durationMs) && durationMs >= 0 ? durationMs : 0;
  const histogram = state.durations.get(key) || {
    count: 0,
    sum: 0,
    buckets: new Map(HISTOGRAM_BUCKETS.map(bucket => [bucket, 0])),
  };
  histogram.count += 1;
  histogram.sum += duration;
  for (const bucket of HISTOGRAM_BUCKETS) {
    if (duration <= bucket) histogram.buckets.set(bucket, histogram.buckets.get(bucket) + 1);
  }
  state.durations.set(key, histogram);
}

export function setActiveJobs(value) {
  state.activeJobs = Math.max(0, Number(value) || 0);
}

export function recordBrowserLaunch() {
  state.browserLaunches += 1;
  state.activeBrowsers += 1;
}

export function recordBrowserLaunchFailure() {
  state.browserLaunchFailures += 1;
}

export function recordBrowserClose() {
  state.browserCloses += 1;
  state.activeBrowsers = Math.max(0, state.activeBrowsers - 1);
}

export function renderPrometheus() {
  const output = [
    '# HELP admicro_extractor_metric_schema_info Metrics schema version.',
    '# TYPE admicro_extractor_metric_schema_info gauge',
    'admicro_extractor_metric_schema_info{version="1"} 1',
    '# HELP admicro_extractor_jobs_total Completed, failed, cancelled, or rejected jobs.',
    '# TYPE admicro_extractor_jobs_total counter',
  ];
  for (const [key, count] of state.jobs) {
    const [operation, reportType, platform, status, errorType] = key.split('|');
    output.push(
      `admicro_extractor_jobs_total{${labelsText({
        operation,
        report_type: reportType,
        platform,
        status,
        error_type: errorType,
      })}} ${count}`
    );
  }

  output.push(
    '# HELP admicro_extractor_retry_attempts_total Retry attempts after the first request.',
    '# TYPE admicro_extractor_retry_attempts_total counter',
    `admicro_extractor_retry_attempts_total ${state.retryAttempts}`,
    '# HELP admicro_extractor_job_duration_ms Job duration in milliseconds.',
    '# TYPE admicro_extractor_job_duration_ms histogram'
  );
  for (const [key, histogram] of state.durations) {
    const [operation, reportType, platform, status, errorType] = key.split('|');
    const base = { operation, report_type: reportType, platform, status, error_type: errorType };
    for (const bucket of HISTOGRAM_BUCKETS) {
      output.push(
        `admicro_extractor_job_duration_ms_bucket{${labelsText({ ...base, le: bucket })}} ${histogram.buckets.get(bucket)}`
      );
    }
    output.push(
      `admicro_extractor_job_duration_ms_bucket{${labelsText({ ...base, le: '+Inf' })}} ${histogram.count}`,
      `admicro_extractor_job_duration_ms_sum{${labelsText(base)}} ${histogram.sum}`,
      `admicro_extractor_job_duration_ms_count{${labelsText(base)}} ${histogram.count}`
    );
  }

  output.push(
    '# HELP admicro_extractor_browser_launches_total Chromium launches.',
    '# TYPE admicro_extractor_browser_launches_total counter',
    `admicro_extractor_browser_launches_total ${state.browserLaunches}`,
    '# HELP admicro_extractor_browser_launch_failures_total Chromium launch failures.',
    '# TYPE admicro_extractor_browser_launch_failures_total counter',
    `admicro_extractor_browser_launch_failures_total ${state.browserLaunchFailures}`,
    '# HELP admicro_extractor_browser_closes_total Chromium browser closes.',
    '# TYPE admicro_extractor_browser_closes_total counter',
    `admicro_extractor_browser_closes_total ${state.browserCloses}`,
    '# HELP admicro_extractor_browser_active Active Chromium browser instances.',
    '# TYPE admicro_extractor_browser_active gauge',
    `admicro_extractor_browser_active ${state.activeBrowsers}`,
    '# HELP admicro_extractor_active_jobs Active extractor jobs.',
    '# TYPE admicro_extractor_active_jobs gauge',
    `admicro_extractor_active_jobs ${state.activeJobs}`,
    '# HELP admicro_extractor_process_resident_memory_bytes Resident process memory.',
    '# TYPE admicro_extractor_process_resident_memory_bytes gauge',
    `admicro_extractor_process_resident_memory_bytes ${process.memoryUsage().rss}`
  );
  return `${output.join('\n')}\n`;
}

export function resetMetrics() {
  state.jobs.clear();
  state.retryAttempts = 0;
  state.durations.clear();
  state.browserLaunches = 0;
  state.browserLaunchFailures = 0;
  state.browserCloses = 0;
  state.activeBrowsers = 0;
  state.activeJobs = 0;
}
