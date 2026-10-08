---
'@owox/backend': minor
'@owox/connectors': minor
'@owox/idp-owox-better-auth': minor
'@owox/web': minor
---

Update runtime dependencies to address known security advisories in HTTP requests, gRPC certificate authorization, TOML parsing, and URI/query parsing. The HTTP and gRPC updates stay within the existing major versions, preserving integration compatibility.

Pin the FTP dependency used by `get-uri` to `basic-ftp` 6.2.1 to address directory-listing denial of service, preserving the Databricks SQL client and proxy stack versions.

FTP data connections now use the control host by default (`allowSeparateTransferHost: false`). The supported same-host FTP/PAC path is covered by runtime compatibility fixtures; deployments using a separate FTP transfer host require compatibility review before rollout.

Deployment images use the verified dependency versions from the release lockfile, avoiding vulnerable packages inherited from an older runtime image. Image checks verify the installed dependency inventory and application readiness before publication.
