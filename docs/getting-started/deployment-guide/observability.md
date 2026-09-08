# Admicro Extractor Observability

The private Admicro extractor exposes Prometheus-compatible metrics at `/metrics`. Keep this
endpoint on the private application network; it contains operational counters but no tenant IDs,
credentials, raw provider payloads, or report data.

## Metrics contract

- `admicro_extractor_jobs_total` counts `preview` and `extract` outcomes by bounded operation,
  report type, platform, status, and error type.
- `admicro_extractor_retry_attempts_total` counts actual retry attempts after the first request.
  It increments once per request where `attempt > 1`, stays label-free, and never exposes tenant
  IDs, secrets, or raw provider payloads.
- `admicro_extractor_job_duration_ms` exposes duration histograms. Use p50/p95 over a five-minute
  window for latency alerts.
- `admicro_extractor_browser_launches_total`, `admicro_extractor_browser_launch_failures_total`,
  `admicro_extractor_browser_closes_total`, and `admicro_extractor_browser_active` track Chromium
  lifecycle leaks and launch pressure.
- `admicro_extractor_process_resident_memory_bytes` tracks sidecar RSS.

Retry rate should use `rate(admicro_extractor_retry_attempts_total[5m])`. Preview and retry
activity is operational telemetry only and must not be joined to billable connector-run
consumption.

Import `deploy/observability/admicro-extractor-dashboard.json` into Grafana and bind a Prometheus
datasource. The dashboard is a starting point; production alert thresholds belong to the operator
because browser capacity and provider quotas vary by deployment.

## Provider sandbox

The secret-free provider/browser contract lane uses `docker-compose.provider-sandbox.yml` and
`.github/workflows/provider-sandbox.yml`. It runs a local provider fixture, the adapter-level Google
and Facebook OAuth round-trip, Redis replay configuration, sidecar unit tests, and connector
contract tests on a private network. It covers health plus OAuth success/denial/expiry responses.
Live browser/provider smoke tests remain manual or nightly and must inject credentials directly
from the secret store; the remaining browser round-trip lane is not automated here.
