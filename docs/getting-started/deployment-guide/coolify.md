# Coolify Deployment

This guide describes the production deployment shape for P2PDigital Data Marts on Coolify.

For MCP transport or OAuth changes, also complete the
[MCP staging, canary and production gates](./mcp-rollout.md).

## Deployment summary

Deploy two private applications from immutable GHCR image tags:

- Main runtime: `ghcr.io/<owner>/<repo>:sha-<git-sha>`.
- Admicro extractor sidecar: `ghcr.io/<owner>/<repo>/admicro-extractor:sha-<git-sha>`.

The main runtime serves the web UI and backend. The Admicro sidecar runs Playwright and exposes
only the internal extractor contract:

- `GET /healthz`
- `POST /v1/preview`
- `POST /v1/extract`

Do not expose the sidecar publicly. Put both applications on the same private Coolify network and
set `ADMICRO_EXTRACTOR_URL=http://<sidecar-private-host>:8091` on the main runtime.

## Required environment variables

Main runtime:

- `PUBLIC_ORIGIN`: public app origin, without a trailing slash.
- `DB_TYPE` and matching database variables.
- `IDP_PROVIDER` and matching identity-provider variables.
- `LICENSE_KEY`: required for licensed report runs.
- `ADMICRO_EXTRACTOR_ENABLED=true`: enables the `AdmicroAds` connector.
- `ADMICRO_EXTRACTOR_URL`: private sidecar URL.
- `ADMICRO_EXTRACTOR_SHARED_SECRET`: secret used to sign sidecar requests.
- `ADMICRO_EXTRACTOR_MAX_CONCURRENCY`: browser job limit; keep low for MVP.
- `ADMICRO_EXTRACTOR_NONCE_STORE=redis`: required before running more than one sidecar replica.
- `ADMICRO_EXTRACTOR_REDIS_URL`: private Redis connection string for replay protection.

Admicro sidecar:

- `NODE_ENV=production`.
- `PORT=8091`.
- `ADMICRO_EXTRACTOR_ENABLED=true`.
- `ADMICRO_EXTRACTOR_SHARED_SECRET`: same secret as the main runtime.
- `ADMICRO_EXTRACTOR_MAX_CONCURRENCY`: defaults to `2`.
- `ADMICRO_EXTRACTOR_NONCE_STORE`: use `memory` for one replica or `redis` for horizontal scaling.
- `ADMICRO_EXTRACTOR_REDIS_URL`: private Redis connection string when nonce storage is `redis`.

Store secrets in Coolify secrets or GitHub Actions secrets. Do not commit them, print them in logs,
or put them in ConfigMap-style plain text. Rotate any token pasted into chat or logs before using
deployment automation.

## CI/CD workflow

`.github/workflows/p2pdigital-production.yml` is the production reliability gate:

- Runs `npm run lint`.
- Runs `npm run type-check -w @owox/web`.
- Runs targeted Admicro connector, extractor, and backend tests.
- Runs non-backend workspace tests, then the backend suite serially to avoid cloud SDK and SQLite
  fixture contention on shared CI runners.
- Runs `npm run build`.
- Generates the CLI manifest and stages built runtime artifacts with the unchanged npm workspace
  manifests and lockfile in `output/runtime-context`.
- Builds both images from digest-pinned runtime bases so rerunning the same Git SHA does not silently
  pick up a newer upstream `latest` image.
- Installs main-runtime production dependencies from the lockfile in Linux and audits the actual
  installed dependency inventory in both candidate images before any image is pushed.
- Builds and smokes the main runtime image through `/health/ready`.
- Builds and smokes the sidecar image through `/healthz`.
- Pushes both images to GHCR with immutable `sha-<git-sha>` tags on `main` and manual runs.
- Triggers Coolify after all checks and image pushes pass when `COOLIFY_DEPLOY_ENABLED=true` on
  `main`; `workflow_dispatch` can also request a deployment. Both paths require MySQL for the
  application, plugin collections and native Better Auth databases. SQLite, blank/default or
  unknown storage stops the workflow before PATCH or deploy; use a controlled stopped-writer
  rollout with a fresh app/auth backup instead. Do not enable automatic deploy for SQLite.

CI builds the monorepo before creating the runtime image. The main Dockerfile uses a clean Node.js
base and the staged context, preserving workspace links, the CLI manifest and both CommonJS/ESM
helper exports. No dependency tree is inherited from an older OWOX application image. Coolify
pulls the verified image and does not build the monorepo over SSH. The committed legacy runtime
tarball is not used by this workflow.

Configure GitHub for deploy automation:

- `COOLIFY_URL` secret.
- `COOLIFY_API_TOKEN` secret with minimum application read/update permission. It pins each Docker
  Image application to the immutable image tag and reads deployment status.
- `COOLIFY_DEPLOY_TOKEN` secret with minimum deploy permission. It only starts deployments.
- `COOLIFY_MAIN_RESOURCE_UUID` repository variable.
- `COOLIFY_ADMICRO_RESOURCE_UUID` repository variable.
- `COOLIFY_DEPLOY_ENABLED=true` repository variable, enabled only after the first green workflow
  run and rollback rehearsal.

Configure each Coolify resource as a Docker Image application and give Coolify pull access to the
private GHCR packages. The two UUIDs must identify different applications. Before updating either
application, the workflow reads both resources and requires `build_pack=dockerimage`. It then updates
only image and healthcheck fields, sending `health_check_port` as a JSON string (`"8091"` or `"3000"`),
and reads each resource back to verify the exact image SHA tag and all requested healthcheck settings.
Both resources use a self-contained `cmd` healthcheck with Node `fetch`, an exact HTTP 200 check,
and a four-second timeout. The command is
`node /usr/local/bin/owox-http-healthcheck.cjs <path> <default-port>` because Coolify validates command
healthchecks with a restricted character pattern (`^[a-zA-Z0-9 \-_.\/:=@,+]+$`); inline
`node -e` JavaScript is rejected by that validator. The script is bundled in both images, so the
deployment does not require `curl`, `wget`, or a host-mounted script; the slim main image does not
include those HTTP CLI tools.
The probe respects the runtime `PORT` value and uses the supplied default only when `PORT` is
unset or empty. Invalid ports, redirects, non-200 responses, and timed-out requests fail the probe.
It starts the sidecar before the main runtime and waits for both Coolify deployments to reach
`finished`. It does not use the `docker_tag` deploy parameter because Coolify reserves that parameter
for Docker Image preview deployments with a pull-request ID. Coolify does not rebuild repository
source.

Existing P2PDigital resources may still report `build_pack=dockerfile` with an empty image/tag. On
Coolify `v4.0.0-beta.473`, the application PATCH validator does not accept `build_pack=dockerimage`,
so the workflow does not attempt to convert source-build applications. See the pinned Coolify
[application update handler](https://github.com/coollabsio/coolify/blob/v4.0.0-beta.473/app/Http/Controllers/Api/ApplicationsController.php#L2474),
[shared validation rules](https://github.com/coollabsio/coolify/blob/v4.0.0-beta.473/bootstrap/helpers/api.php#L82),
and [build-pack enum](https://github.com/coollabsio/coolify/blob/v4.0.0-beta.473/app/Enums/BuildPackTypes.php).
If either resource is a source-build application, preflight stops before any resource is modified or
deployed. Create replacement Docker Image applications in the Coolify UI, copy the environment and
health settings, attach the same private network, configure GHCR pull credentials, and update
`COOLIFY_MAIN_RESOURCE_UUID` and `COOLIFY_ADMICRO_RESOURCE_UUID`. Check that both replacements can
pull the exact `sha-<git-sha>` image before switching public traffic. Do not bypass the failed
preflight by re-enabling source builds: that could deploy unverified branch content.

Protect `main` with a pull request requirement, at least one approving review, stale approval
dismissal when new commits arrive, and no routine bypass for administrators. Require the stable
`Lint, test, and build`, `E2E API Tests`, `E2E Browser Tests`, `Audit all`, root quality, and docs
quality checks once their names have been confirmed in a green PR run. Leave
`COOLIFY_DEPLOY_ENABLED` unset until at least one green run and rollback rehearsal exist, then
enable it only for deployments whose app, plugin collections and native auth databases use MySQL.
SQLite deployments remain manual with job drain, stopped-writer backup and single-writer checks.
`workflow_dispatch` does not bypass these storage requirements.

The `Release PR` workflow needs repository **Actions → General → Workflow permissions → Allow GitHub
Actions to create and approve pull requests**. It uses a custom Changesets version command so
changelog and lockfile updates are committed on the release PR branch. The `Snapshot` workflow
publishes upstream npm package names; forks skip it unless `NPM_PUBLISH_ENABLED=true` and npm
trusted publishing has been configured for every package and the exact workflow path. Do not enable
that variable solely to make the check green.

The docs workflow always builds the site. Publishing from this repository uses GitHub Pages only
when `DOCS_PAGES_ENABLED=true`, the repository Pages source is **GitHub Actions**, and the optional
`DOCS_SITE`, `DOCS_BASE`, and `DOCS_CNAME` variables match the actual domain. Do not set a CNAME
for `docs.owox.com` in this fork; use a domain owned by this deployment, such as
`docs.p2pdigital.io.vn` after its DNS and Pages custom-domain verification are complete.

## Job/queue setup

For a single-replica deployment, `ADMICRO_EXTRACTOR_NONCE_STORE=memory` is sufficient. Before
running multiple sidecar replicas, configure private Redis with
`ADMICRO_EXTRACTOR_NONCE_STORE=redis`; the replay claim uses atomic `SET NX PX` and fails closed
when Redis is unavailable.

Set `ADMICRO_EXTRACTOR_MAX_CONCURRENCY` according to CPU and memory headroom. Start with `2` and
lower it to `1` if Chromium memory pressure appears. The connector still runs campaign scopes
sequentially and should only advance cursor state after every node and scope for a day succeeds.

## Monitoring plan

Coolify command healthchecks use Node to request:

- Main runtime: `GET /health/ready`.
- Admicro sidecar: `GET /healthz`.

Both commands run the image-bundled `/usr/local/bin/owox-http-healthcheck.cjs` script. If a legacy
resource still points to a host-mounted fallback such as `/opt/p2pdigital-healthcheck.cjs`, replace it
with the bundled command when deploying an image that contains this script.

Production smoke after each deploy:

- Main readiness returns HTTP 200.
- Sidecar health returns HTTP 200 on the private network.
- `/api/connectors` includes `AdmicroAds` when `ADMICRO_EXTRACTOR_ENABLED=true`.
- `/api/connectors/AdmicroAds/specification` returns connector configuration without password.
- Field preview succeeds with valid credentials entered through the UI.
- Invalid Admicro credentials show a reconnect/authentication state, not a generic 500.

Monitor logs for connector status, retry count, run duration, report type, platform, and row count.
Never log Admicro passwords, cookies, raw `DATAVIEW`, project IDs, credential IDs, or HMAC secrets.
Alert on repeated `429`, `5xx`, credential failures, stale data, and sidecar health failures.
Scrape the private `GET /metrics` endpoint for bounded job counters, p95 latency, rate-limit
pressure, Chromium launch failures, active browser count, and RSS. Import
`deploy/observability/admicro-extractor-dashboard.json` into Grafana for the starter dashboard.

## Release checklist

- Old Coolify tokens that appeared outside a secret store are revoked.
- New Coolify token is stored only in GitHub/Coolify secret storage.
- Coolify API token can update only the two production applications; deploy token can deploy only
  those resources.
- CI workflow has a green run on the exact Git SHA.
- Main and sidecar GHCR images exist with `sha-<git-sha>` tags.
- Both Coolify resource UUIDs are different and already report `build_pack=dockerimage`; preflight
  passes before image or health settings are updated.
- Coolify main app uses the runtime image SHA and `/health/ready`.
- Coolify sidecar app uses the sidecar image SHA, private networking, one replica, and `/healthz`.
- Required migrations have been reviewed; no rollback-blocking migration is pending.
- Admicro feature flag and HMAC secret are set on the main runtime.
- Real Admicro credentials are entered only through the product UI.
- Record the configured billing mode. In `LICENSE` mode, connector and other process runs are
  unbilled; confirm a successful billable report or `RunKind.MCP_QUERY_RUN` is charged once.
  In `INTERNAL` mode, confirm connector consumption is registered once after success.
  Preview, failed/cancelled runs, and retries must not add duplicate charges in either mode.
- Release changesets are present when release policy requires them and use the owning GitHub Issue
  number.

## Rollback plan

Keep the previous successful runtime image SHA and sidecar image SHA before every deploy.

To roll back:

1. In Coolify, set the main runtime image tag back to the previous `sha-<git-sha>`.
2. Set the Admicro sidecar image tag back to the matching previous `sha-<git-sha>`.
3. Deploy sidecar first if the HMAC or extractor contract changed; otherwise either order is safe.
4. Verify `/healthz` and `/health/ready`.
5. Run a connector smoke with a small date range.

If a database migration is involved, review whether it is backward compatible before rollback. Use
the repository migration commands only when the down migration is known safe for the affected data.
