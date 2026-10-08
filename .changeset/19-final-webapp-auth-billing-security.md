---
'@owox/backend': minor
'@owox/idp-owox-better-auth': minor
'owox': minor
---

# Production authentication, scheduling, and security fixes

Production startup requires an explicit `IDP_PROVIDER` and respects the configured authentication provider. The development backend cannot start in production; deployed containers run with `NODE_ENV=production`.

Report consumption uses a stable billing identity from the persisted run, including when a run is reconstructed or retried. Connector and report scheduling admit the configured concurrency limit and serialize competing claims on MySQL and MariaDB.

Notification responses redact credentials in webhook URLs. Saving an unchanged masked URL preserves the original delivery destination. Webhook and identity-provider logs omit credentials, tokens, and raw identity payloads.

Dynamic client registration rate limits persist across workers and restarts. Registration requires a stable identity secret and fails closed when it is unavailable.

Refs #19.
