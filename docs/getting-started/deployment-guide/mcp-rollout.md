# MCP 2026-07-28 rollout

The DigitalReport endpoint remains `https://digitalreport.p2pdigital.io.vn/mcp`.
Use Node.js >=22.22.0 and the locked SDK v2 dependencies. This guide describes
release gates; its presence does not certify a deployed environment.

## MVP: authentication and language

Keep the existing Codex URL entry and OAuth PKCE flow. Start a fresh client login
and retain its exact loopback redirect. Confirm the local client receives the
callback and successfully calls `get_project_context`.

Both `initialize.instructions` and `server/discover.instructions` use the same
instruction source: Vietnamese by default, with the user's requested language
taking precedence. Protocol identifiers, tool schemas, errors, and code retain
their original spelling. Host and user instructions remain authoritative.

## V1: protocol and data model

The SDK selects the modern or legacy handler per request. Modern clients send
`server/discover` with `params._meta.io.modelcontextprotocol/protocolVersion`
and client capabilities. Legacy clients retain `initialize`. Discovery advertises
`supportedVersions: ["2026-07-28"]`; the separate legacy adapter also accepts
`2025-11-25`, `2025-06-18`, `2025-03-26`, `2024-11-05`, and `2024-10-07`.

Modern HTTP requests carry `MCP-Protocol-Version` and `Mcp-Method`, plus `Mcp-Name`
for named operations such as `tools/call`. Header/body mismatches return HTTP 400
with `-32020`; unsupported versions return HTTP 400 with `-32022`; unknown
methods return HTTP 404 with `-32601`. Clients advertise both `application/json`
and `text/event-stream` in `Accept`. The SDK chooses JSON or SSE and adds the
modern result envelope. Currently implemented tools complete with
`resultType: "complete"`; no interactive input workflow is advertised.

Requests without `Origin` are accepted for native clients. When present, `Origin`
must exactly match the trusted authenticated resource origin. Invalid origins
return HTTP 403. Preserve the MCP headers through the ingress and disable proxy
buffering for SSE. Do not derive trusted origins from forwarded request headers.

Each request creates a server bound to its authenticated project, client and
scopes. Discovery and tool-list cache hints are `cacheScope: "private"` and
`ttlMs: 0`. There is no shared session store and no cross-project result cache.

OAuth keeps the existing code, token, refresh, project and audience bindings.
DCR clients retain their persisted registry rows. CIMD clients use their full
HTTPS metadata URL as their identity and resolve metadata through a bounded
in-memory cache; they do not insert URL identifiers into the length-limited DCR
table. No database migration is needed. Metadata is client configuration, never
an authorization grant: each authorization still validates redirect URI, PKCE,
resource, scopes and project membership.

Configure CIMD using the documented
[environment variables](./environment-variables.md). Review the HTTPS metadata
origin allowlist for your clients and keep existing redirect-origin restrictions.
Metadata fetches must reject private network destinations and unsafe redirects.
For OWOX-managed deployment, inspect the ODM ConfigMap and both staging and
production overlays in `OWOX/k8s` before promotion; this repository does not own
those deployment resources.

## Validation gates

Run from the repository root after installing the lockfile dependencies:

```bash
npm run build -w @owox/backend
npm test -w @owox/backend -- --runInBand
npm run test:e2e -w @owox/backend -- --runInBand
npm test -w @owox/idp-owox-better-auth -- --runInBand
npm test -w @owox/idp-protocol
npm run lint -w @owox/backend
npm run format:check -w @owox/backend
```

Record the exact SHA, client version, image digest and evidence for each gate:

| Client or boundary | Required evidence                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------- |
| SDK v2 modern      | Discovery, capabilities, instructions, private cache, tool schemas and a real tool result                     |
| HTTP transport     | Missing/mismatched headers, version/method errors, JSON/SSE, Origin rejection, disconnect cancellation        |
| Legacy             | Successful initialize, tool listing and tool call using a pre-2026 protocol version                           |
| OAuth DCR and CIMD | PKCE, exact loopback redirect, issuer, resource, scopes, project selection, metadata cache/SSRF validation    |
| Codex              | Fresh login and `get_project_context`; repeat after refresh and after restarting the client                   |
| Claude             | Fresh login, selected project and a read tool; record the actual protocol revision                            |
| Tenant isolation   | Credentials for project A cannot read or mutate a known object in project B                                   |
| Language           | Vietnamese default; explicit English request produces English; tool identifiers stay exact                    |
| Billing and sync   | Cancellation is not billed; successful billable tool is charged once; sync/report retry behavior is unchanged |

An in-process SDK test does not replace a live Codex or Claude acceptance run.
Do not mark refresh/restart or multi-project isolation verified without executing
those checks against the candidate environment.

## Staging, canary and production

1. Build an immutable image from the tested commit. Record the currently deployed
   image and environment settings before changing either. Use the
   [Coolify workflow](./coolify.md) for DigitalReport or `OWOX/k8s` for managed ODM.
2. Deploy to staging with equivalent ingress and OAuth origin/resource settings.
   Run the entire validation matrix, including a fresh browser callback from the
   actual client computer. Keep tokens and authorization codes out of evidence.
3. Promote the same image digest to a canary with explicitly selected test
   projects. Preserve deterministic routing for the authorization flow. Run the
   Codex/legacy, refresh and cross-project checks again.
4. Compare canary HTTP status distribution, callback completion/timeouts,
   `-32020`/`-32022` errors, tool failures and p95 latency to the previous image.
   Stop promotion for a new authentication failure, isolation failure, incorrect
   charge, or sustained error/latency regression.
5. Promote the same digest to production only after the gates pass. Record the
   rollout outcome and retain the previous image/configuration for rollback.

The MCP transport keeps existing tool instrumentation. Use ingress status/latency
logs and client login outcomes for protocol/OAuth evidence; no new monitoring
dashboard or distributed session service is implied by this migration. Never
log access/refresh tokens, authorization codes, PKCE verifiers or raw metadata
documents.

To roll back, restore the previous runtime image and MCP environment settings,
redeploy, and rerun readiness, legacy login and `get_project_context`. This change
requires no destructive database rollback. A client that only supports modern
MCP will need a legacy-compatible client while the old image is active.

Security and tenant isolation depend on preserving issuer/resource checks,
redirect restrictions and authenticated project binding. Analytics metric
sources, formulas, grain, timezones, sync frequencies and billing prices are
unchanged. Query/report tools retain their existing permissions, retry and credit
accounting paths; include their regressions in the release evidence.

## Future

Advertise subscriptions, tasks, elicitation, advanced multi-round-trip requests,
resumability or shared multi-node sessions only after implementing and testing
them. Expand the client conformance matrix with observed versions and outcomes.
Separate workspace language policies only when the product requires independent
language configuration.

## References

- [MCP 2026-07-28 Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [Server discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
- [OAuth client registration](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/client-registration)
- [TypeScript SDK v2 migration](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/migration/upgrade-to-v2.md)
