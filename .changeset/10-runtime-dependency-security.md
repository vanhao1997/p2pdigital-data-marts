---
'@owox/backend': minor
'@owox/connectors': minor
'@owox/idp-owox-better-auth': minor
'@owox/web': minor
---

Update runtime dependencies to address known security advisories in HTTP requests, gRPC certificate authorization, TOML parsing, and URI/query parsing. The HTTP and gRPC updates stay within the existing major versions, preserving integration compatibility.

Deployment images include the patched HTTP/gRPC packages across SDK dependencies and remove stale build workspace links to support runtime dependency verification.
