# Admicro Extractor Observability

## ODM operational counters

The backend emits `operational_metric` JSON log records with bounded `metric`, `outcome`, and,
for duration-aware events, a reviewed `durationBucket`. Each record represents one attempt or
transition; aggregate records by event time in the log collector to build counters. No tenant, IP,
API-key, OAuth client, credential, request body, upstream error message, or arbitrary label is
included.

| Metric               | Outcomes                                            | Meaning                                                                                                                                        |
| -------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `api_key_exchange`   | `success`, `unauthorized`, `rate_limited`, `failed` | Result of the public exchange endpoint. `failed` includes oversized bodies and unexpected errors.                                              |
| `oauth_registration` | `accepted`, `rejected`, `rate_limited`, `failed`    | Result of the dynamic registration endpoint. Disabled registration is `rejected`.                                                              |
| `tenant_boundary`    | `mismatch`, `missing_context`                       | Rejected tenant guard checks. Count spikes as security signals; no project identifiers are logged.                                             |
| `billing_publish`    | `accepted`, `rejected`, `skipped`                   | Attempt to publish a consumption command. `accepted` means Pub/Sub acknowledged the publish, **not** that billing consumed or deduplicated it. |
| `connector_sync`     | `success`, `failed`, `interrupted`, `retry`         | Connector execution outcome. A `retry` record means an interrupted run was resumed; terminal outcomes include a `durationBucket`.              |
| `report_delivery`    | `success`, `failed`, `cancelled`, `retry`           | Report destination execution outcome. Terminal outcomes include a `durationBucket`.                                                            |
| `data_freshness`     | `complete`, `partial`, `unavailable`                | Coverage returned by an explicit Data Mart source freshness refresh. No timestamp or project identifier is logged.                             |

`billing_publish` cannot report downstream `duplicated` or `consumed` outcomes. Those need
receiver-side telemetry tied to the billing service's durable deduplication result. Keep billing
alerts separate from connector and report delivery signals.

The [Vietnamese Data Mart metric dictionary](../../vi/analytics/metric-dictionary.md)
defines product dashboard metrics separately from operational counters.

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
