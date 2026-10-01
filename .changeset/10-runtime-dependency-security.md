---
'@owox/backend': minor
'@owox/connectors': minor
'@owox/idp-owox-better-auth': minor
'@owox/web': minor
---

Update runtime dependencies to address known security advisories in HTTP requests, gRPC certificate authorization, TOML parsing, and URI/query parsing. The HTTP and gRPC updates stay within the existing major versions, preserving integration compatibility.

Deployment images use the verified dependency versions from the release lockfile, avoiding vulnerable packages inherited from an older runtime image. Image checks verify the installed dependency inventory and application readiness before publication.
