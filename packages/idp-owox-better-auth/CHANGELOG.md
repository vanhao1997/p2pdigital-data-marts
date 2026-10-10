# @owox/idp-owox-better-auth

## 0.33.0

### Minor Changes 0.33.0

- f13fc57: Update runtime dependencies to address known security advisories in HTTP requests, gRPC certificate authorization, TOML parsing, and URI/query parsing. The HTTP and gRPC updates stay within the existing major versions, preserving integration compatibility.

  Pin the FTP dependency used by `get-uri` to `basic-ftp` 6.2.1 to address directory-listing denial of service, preserving the Databricks SQL client and proxy stack versions.

  FTP data connections now use the control host by default (`allowSeparateTransferHost: false`). The supported same-host FTP/PAC path is covered by runtime compatibility fixtures; deployments using a separate FTP transfer host require compatibility review before rollout.

  Deployment images use the verified dependency versions from the release lockfile, avoiding vulnerable packages inherited from an older runtime image. Image checks verify the installed dependency inventory and application readiness before publication.

- cf56d59: # Production authentication, scheduling, and security fixes

  Production startup requires an explicit `IDP_PROVIDER` and respects the configured authentication provider. The development backend cannot start in production; deployed containers run with `NODE_ENV=production`.

  Report consumption uses a stable billing identity from the persisted run, including when a run is reconstructed or retried. Connector and report scheduling admit the configured concurrency limit and serialize competing claims on MySQL and MariaDB.

  Notification responses redact credentials in webhook URLs. Saving an unchanged masked URL preserves the original delivery destination. Webhook and identity-provider logs omit credentials, tokens, and raw identity payloads.

  Dynamic client registration rate limits persist across workers and restarts. Registration requires a stable identity secret and fails closed when it is unavailable.

  Refs #19.

### Patch Changes 0.33.0

- Updated dependencies [d706ab3]
  - @owox/idp-protocol@0.33.0
  - @owox/internal-helpers@0.33.0

## 0.32.0

### Patch Changes 0.32.0

- @owox/internal-helpers@0.32.0
- @owox/idp-protocol@0.32.0

## 0.31.0

### Patch Changes 0.31.0

- @owox/internal-helpers@0.31.0
- @owox/idp-protocol@0.31.0

## 0.30.1

## 0.30.0

### Patch Changes 0.30.0

- @owox/internal-helpers@0.30.0
- @owox/idp-protocol@0.30.0

## 0.29.0

### Patch Changes 0.29.0

- @owox/internal-helpers@0.29.0
- @owox/idp-protocol@0.29.0

## 0.28.0

### Patch Changes 0.28.0

- @owox/internal-helpers@0.28.0
- @owox/idp-protocol@0.28.0

## 0.27.1

## 0.27.0

### Patch Changes 0.27.0

- @owox/internal-helpers@0.27.0
- @owox/idp-protocol@0.27.0

## 0.26.0

### Patch Changes 0.26.0

- @owox/internal-helpers@0.26.0
- @owox/idp-protocol@0.26.0

## 0.25.0

### Patch Changes 0.25.0

- @owox/internal-helpers@0.25.0
- @owox/idp-protocol@0.25.0

## 0.24.0

### Patch Changes 0.24.0

- @owox/internal-helpers@0.24.0
- @owox/idp-protocol@0.24.0

## 0.23.0

### Patch Changes 0.23.0

- @owox/internal-helpers@0.23.0
- @owox/idp-protocol@0.23.0

## 0.22.0

### Patch Changes 0.22.0

- @owox/internal-helpers@0.22.0
- @owox/idp-protocol@0.22.0

## 0.21.1

## 0.21.0

### Patch Changes 0.21.0

- @owox/internal-helpers@0.21.0
- @owox/idp-protocol@0.21.0

## 0.20.0

### Patch Changes 0.20.0

- @owox/internal-helpers@0.20.0
- @owox/idp-protocol@0.20.0

## 0.19.0

### Patch Changes 0.19.0

- @owox/internal-helpers@0.19.0
- @owox/idp-protocol@0.19.0
