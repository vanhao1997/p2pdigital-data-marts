# Project Overview

## MVP

The Projects page shows a permission-filtered summary per project and quick
links that select the project before opening a Data Mart or its full list.

### Data Model

No new tables or migrations. `GET /api/project-overviews/:projectId` uses the
existing main database and returns:

- `projectId`: target project; live IDP membership is required.
- `dataMartsCount`: count of visible, non-deleted Data Marts, including drafts.
- `dataMarts`: five newest visible IDs, titles and statuses; ties sort by ID.
- `connectors`: unique configured `connector.source.name` values with the
  count of visible Data Marts using each provider. No configuration is returned.
- `runningSyncsCount`: count of visible Data Mart runs where type is `CONNECTOR`
  and status is `RUNNING`. Pending, completed, report, deleted and other-project
  runs are excluded. This is not a count of enabled schedules or latest runs.
- `observedAt`: UTC response observation time, not source-data freshness.

Grain is one project for one authenticated user. All metrics use the target
project's roles, ownership and context visibility. There is no calendar window
or timezone aggregation. The browser refreshes every 15 seconds while visible,
with cancellable requests and user/project-specific cache keys.

### Security And Operational Risks

API keys and plugin tokens are rejected: project-bound credentials cannot query
other project memberships. View-only sessions cannot cross their active project.
Live IDP failure fails closed. Archived projects remain readable to members.
Failed refreshes show unavailable state rather than stale totals or false zeros.

Sync counts reflect persisted run status, not a worker heartbeat; stale worker
records depend on the existing recovery system. The endpoint does not trigger
syncs, change schedules, select a project, or contact connector providers.

No billing or entitlement behavior changes. These counts are not billable usage,
credit balance or a concurrency allowance. Billing settlement and real-provider
extraction remain separate acceptance gates.

### Acceptance Checks

- API tests exercise actual NestJS, migrations and SQLite with controlled IDP
  claims, target roles, selected contexts, owners, tenant boundaries and failures.
- Browser tests cover mobile and desktop, exact totals beyond five preview rows,
  provider names, an old running record, automatic refresh and drilldown.
- UI tests cover loading, failure, retry, empty and pending navigation states.
- Release requires verified images, backup rehearsal and a single-writer cutover.

## V1

Project-level sync history and last successful completion, with pagination and
explicit refresh timestamps.

## Future

Worker-health-aware activity, stalled-sync alerts and duration trends. Each
requires its own source, retention, access and billing definitions before work.
