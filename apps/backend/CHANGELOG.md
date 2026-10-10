# @owox/backend

## 0.33.0

### Minor Changes 0.33.0

- f13fc57: Update runtime dependencies to address known security advisories in HTTP requests, gRPC certificate authorization, TOML parsing, and URI/query parsing. The HTTP and gRPC updates stay within the existing major versions, preserving integration compatibility.

  Pin the FTP dependency used by `get-uri` to `basic-ftp` 6.2.1 to address directory-listing denial of service, preserving the Databricks SQL client and proxy stack versions.

  FTP data connections now use the control host by default (`allowSeparateTransferHost: false`). The supported same-host FTP/PAC path is covered by runtime compatibility fixtures; deployments using a separate FTP transfer host require compatibility review before rollout.

  Deployment images use the verified dependency versions from the release lockfile, avoiding vulnerable packages inherited from an older runtime image. Image checks verify the installed dependency inventory and application readiness before publication.

- d706ab3: Update production dependencies to address IP spoofing, denial-of-service, and SDK advisories. Snowflake connections use the current SDK, and local embedding search uses Transformers.js 4 with the same model and vector dimensions.

  Refs #10.

- 3605efb: Accept ChatGPT CIMD clients that advertise public-client OAuth authentication in their supported methods even when their legacy preference is signed-client authentication. PKCE, exact redirects, resource binding and project permissions remain required.
- d706ab3: Chuẩn hóa MCP server theo protocol `2026-07-28`, giữ tương thích client legacy và
  đặt tiếng Việt làm ngôn ngữ giao tiếp mặc định của MCP agent. OAuth MCP bổ sung
  kiểm tra metadata client hiện đại trong khi vẫn hỗ trợ dynamic client registration.

  OAuth MCP yêu cầu identity provider hỗ trợ MCP OAuth. Provider native `better-auth` hỗ trợ luồng OAuth này với PKCE và token opaque; provider phải được bật và cấu hình đúng trong môi trường triển khai.

  Refs #12.

- cf56d59: # Production authentication, scheduling, and security fixes

  Production startup requires an explicit `IDP_PROVIDER` and respects the configured authentication provider. The development backend cannot start in production; deployed containers run with `NODE_ENV=production`.

  Report consumption uses a stable billing identity from the persisted run, including when a run is reconstructed or retried. Connector and report scheduling admit the configured concurrency limit and serialize competing claims on MySQL and MariaDB.

  Notification responses redact credentials in webhook URLs. Saving an unchanged masked URL preserves the original delivery destination. Webhook and identity-provider logs omit credentials, tokens, and raw identity payloads.

  Dynamic client registration rate limits persist across workers and restarts. Registration requires a stable identity secret and fails closed when it is unavailable.

  Refs #19.

- ce43801: # Create connections and author Data Marts through MCP

  MCP clients can discover supported connectors and warehouse connections, create and configure storage using authorized credential references, and validate access. OAuth and manual credential entry stay in the authenticated web application; MCP does not accept or return plaintext credentials.

  Clients can create draft Data Marts, update their titles, descriptions and definitions, validate setup, inspect setup status, and publish when explicitly requested. Publishing a connector Data Mart retains the existing automatic incremental-run behavior and may incur connector consumption. Creating or editing configuration does not run an extraction or report.

  All new tools enforce the authenticated project, applicable roles and resource permissions in addition to OAuth scopes. Existing query, destination, report and schedule tools remain available.

  Native Better Auth deployments support MCP OAuth sign-in with PKCE, scoped project access and rotating refresh tokens. Existing browser sessions can continue authorization over HTTPS. Storage metadata supplies an authorized opaque credential reference for configuration after web authentication, without returning credential values.

  Refs #20.

- 84f9b89: # Patch template engine security vulnerabilities

  Upgrade Handlebars to the patched 4.7.10 release for backend template rendering,
  notification templates and calculated-field parsing. This addresses the critical
  template injection advisories reported by the release dependency audit.

  Refs #22.

- 9998511: # Project Overview

  Projects now show visible Data Marts, configured connector providers, and currently running connector syncs with quick links into project data.

- 264cdcf: Rebrand to P2PDigital, add Vietnamese (VI) language support, increase project limit to 50
  - Replaced OWOX branding with P2PDigital across all user-facing text, logo, and URLs
  - Added react-i18next with English and Vietnamese locale files
  - Added language switcher (EN/VI) in the user menu with localStorage persistence
  - Localized Data Marts overview hints and actions to match the selected language
  - Increased organization/project creation limit from 20 to 50

### Patch Changes 0.33.0

- Updated dependencies [f13fc57]
- Updated dependencies [d706ab3]
- Updated dependencies [d706ab3]
- Updated dependencies [264cdcf]
- Updated dependencies [820d349]
- Updated dependencies [a55791f]
  - @owox/connectors@0.33.0
  - @owox/idp-protocol@0.33.0
  - @owox/internal-helpers@0.33.0

## 0.32.0

### Patch Changes 0.32.0

- @owox/internal-helpers@0.32.0
- @owox/idp-protocol@0.32.0
- @owox/connectors@0.32.0

## 0.31.0

### Patch Changes 0.31.0

- @owox/internal-helpers@0.31.0
- @owox/idp-protocol@0.31.0
- @owox/connectors@0.31.0

## 0.30.1

## 0.30.0

### Patch Changes 0.30.0

- @owox/internal-helpers@0.30.0
- @owox/idp-protocol@0.30.0
- @owox/connectors@0.30.0

## 0.29.0

### Patch Changes 0.29.0

- @owox/internal-helpers@0.29.0
- @owox/idp-protocol@0.29.0
- @owox/connectors@0.29.0

## 0.28.0

### Patch Changes 0.28.0

- @owox/internal-helpers@0.28.0
- @owox/idp-protocol@0.28.0
- @owox/connectors@0.28.0

## 0.27.1

## 0.27.0

### Patch Changes 0.27.0

- @owox/internal-helpers@0.27.0
- @owox/idp-protocol@0.27.0
- @owox/connectors@0.27.0

## 0.26.0

### Patch Changes 0.26.0

- @owox/internal-helpers@0.26.0
- @owox/idp-protocol@0.26.0
- @owox/connectors@0.26.0

## 0.25.0

### Patch Changes 0.25.0

- @owox/internal-helpers@0.25.0
- @owox/idp-protocol@0.25.0
- @owox/connectors@0.25.0

## 0.24.0

### Patch Changes 0.24.0

- @owox/internal-helpers@0.24.0
- @owox/idp-protocol@0.24.0
- @owox/connectors@0.24.0

## 0.23.0

### Patch Changes 0.23.0

- @owox/internal-helpers@0.23.0
- @owox/idp-protocol@0.23.0
- @owox/connectors@0.23.0

## 0.22.0

### Patch Changes 0.22.0

- @owox/internal-helpers@0.22.0
- @owox/idp-protocol@0.22.0
- @owox/connectors@0.22.0

## 0.21.1

## 0.21.0

### Patch Changes 0.21.0

- @owox/internal-helpers@0.21.0
- @owox/idp-protocol@0.21.0
- @owox/connectors@0.21.0

## 0.20.0

### Patch Changes 0.20.0

- @owox/internal-helpers@0.20.0
- @owox/idp-protocol@0.20.0
- @owox/connectors@0.20.0

## 0.19.0

### Patch Changes 0.19.0

- @owox/internal-helpers@0.19.0
- @owox/idp-protocol@0.19.0
- @owox/connectors@0.19.0

## 0.18.0

### Patch Changes 0.18.0

- @owox/internal-helpers@0.18.0
- @owox/idp-protocol@0.18.0
- @owox/connectors@0.18.0

## 0.17.0

### Patch Changes 0.17.0

- @owox/internal-helpers@0.17.0
- @owox/idp-protocol@0.17.0
- @owox/connectors@0.17.0

## 0.16.0

### Patch Changes 0.16.0

- @owox/internal-helpers@0.16.0
- @owox/idp-protocol@0.16.0
- @owox/connectors@0.16.0

## 0.15.0

### Patch Changes 0.15.0

- @owox/internal-helpers@0.15.0
- @owox/idp-protocol@0.15.0
- @owox/connectors@0.15.0

## 0.14.0

### Patch Changes 0.14.0

- @owox/internal-helpers@0.14.0
- @owox/idp-protocol@0.14.0
- @owox/connectors@0.14.0

## 0.13.0

### Patch Changes 0.13.0

- @owox/internal-helpers@0.13.0
- @owox/idp-protocol@0.13.0
- @owox/connectors@0.13.0

## 0.12.0

### Patch Changes 0.12.0

- @owox/internal-helpers@0.12.0
- @owox/idp-protocol@0.12.0
- @owox/connectors@0.12.0

## 0.11.0

### Patch Changes 0.11.0

- @owox/internal-helpers@0.11.0
- @owox/idp-protocol@0.11.0
- @owox/connectors@0.11.0
- @owox/connector-runner@0.11.0

## 0.10.0

### Patch Changes 0.10.0

- @owox/internal-helpers@0.10.0
- @owox/idp-protocol@0.10.0
- @owox/connectors@0.10.0
- @owox/connector-runner@0.10.0

## 0.9.0

### Patch Changes 0.9.0

- @owox/internal-helpers@0.9.0
- @owox/idp-protocol@0.9.0
- @owox/connectors@0.9.0
- @owox/connector-runner@0.9.0

## 0.8.0

### Patch Changes 0.8.0

- @owox/internal-helpers@0.8.0
- @owox/idp-protocol@0.8.0
- @owox/connectors@0.8.0
- @owox/connector-runner@0.8.0

## 0.7.0

### Patch Changes 0.7.0

- @owox/connectors@0.7.0
- @owox/connector-runner@0.7.0
- @owox/idp-protocol@0.7.0
- @owox/internal-helpers@0.7.0

## 0.6.0

### Patch Changes 0.6.0

- @owox/connectors@0.6.0
- @owox/connector-runner@0.6.0
- @owox/idp-protocol@0.6.0

## 0.5.0

### Patch Changes 0.5.0

- @owox/connectors@0.5.0
- @owox/connector-runner@0.5.0
- @owox/idp-protocol@0.5.0

## 0.4.0

### Patch Changes 0.4.0

- @owox/connectors@0.4.0
- @owox/connector-runner@0.4.0

## 0.3.0

### Patch Changes 0.3.0

- @owox/connectors@0.3.0
- @owox/connector-runner@0.3.0

## 0.2.0

### Patch Changes 0.2.0

- @owox/connectors@0.2.0
- @owox/connector-runner@0.2.0
