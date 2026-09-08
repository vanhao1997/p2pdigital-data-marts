import { afterEach, describe, expect, it } from 'vitest';
import {
  recordBrowserClose,
  recordBrowserLaunch,
  recordJob,
  renderPrometheus,
  resetMetrics,
  setActiveJobs,
} from '../src/metrics.js';

afterEach(() => resetMetrics());

describe('Admicro extractor metrics', () => {
  it('exports bounded job labels and duration histograms', () => {
    recordJob({
      operation: 'extract',
      reportType: 'campaign',
      platform: 'desktop',
      status: 'failed',
      errorType: 'provider',
      durationMs: 500,
    });

    const output = renderPrometheus();
    expect(output).toContain('admicro_extractor_metric_schema_info{version="1"} 1');
    expect(output).toContain(
      'admicro_extractor_jobs_total{operation="extract",report_type="campaign",platform="desktop",status="failed",error_type="provider"} 1'
    );
    expect(output).toContain('admicro_extractor_job_duration_ms_bucket{');
    expect(output).toContain('le="500"} 1');
    expect(output).not.toContain('tenant');
  });

  it('counts retry attempts only after the first request', () => {
    recordJob({
      operation: 'extract',
      reportType: 'campaign',
      platform: 'desktop',
      status: 'failed',
      errorType: 'provider',
      attempt: 1,
      retryCount: 0,
      durationMs: 500,
    });

    let output = renderPrometheus();
    expect(output).toContain('admicro_extractor_retry_attempts_total 0');
    expect(output).not.toContain('admicro_extractor_retry_attempts_total{');

    recordJob({
      operation: 'extract',
      reportType: 'campaign',
      platform: 'desktop',
      status: 'failed',
      errorType: 'provider',
      attempt: 2,
      retryCount: 1,
      durationMs: 500,
    });

    recordJob({
      operation: 'extract',
      reportType: 'campaign',
      platform: 'desktop',
      status: 'failed',
      errorType: 'provider',
      attempt: 3,
      retryCount: 2,
      durationMs: 500,
    });

    output = renderPrometheus();
    expect(output).toContain('admicro_extractor_retry_attempts_total 2');
  });

  it('tracks active jobs and browser lifecycle without high-cardinality labels', () => {
    setActiveJobs(2);
    recordBrowserLaunch();
    recordBrowserClose();

    const output = renderPrometheus();
    expect(output).toContain('admicro_extractor_active_jobs 2');
    expect(output).toContain('admicro_extractor_browser_launches_total 1');
    expect(output).toContain('admicro_extractor_browser_closes_total 1');
    expect(output).toContain('admicro_extractor_browser_active 0');
  });
});
