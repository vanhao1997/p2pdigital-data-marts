# @owox/idp-better-auth

## 0.33.0

### Minor Changes 0.33.0

- ce43801: # Create connections and author Data Marts through MCP

  MCP clients can discover supported connectors and warehouse connections, create and configure storage using authorized credential references, and validate access. OAuth and manual credential entry stay in the authenticated web application; MCP does not accept or return plaintext credentials.

  Clients can create draft Data Marts, update their titles, descriptions and definitions, validate setup, inspect setup status, and publish when explicitly requested. Publishing a connector Data Mart retains the existing automatic incremental-run behavior and may incur connector consumption. Creating or editing configuration does not run an extraction or report.

  All new tools enforce the authenticated project, applicable roles and resource permissions in addition to OAuth scopes. Existing query, destination, report and schedule tools remain available.

  Native Better Auth deployments support MCP OAuth sign-in with PKCE, scoped project access and rotating refresh tokens. Existing browser sessions can continue authorization over HTTPS. Storage metadata supplies an authorized opaque credential reference for configuration after web authentication, without returning credential values.

  Refs #20.

- 264cdcf: Rebrand to P2PDigital, add Vietnamese (VI) language support, increase project limit to 50
  - Replaced OWOX branding with P2PDigital across all user-facing text, logo, and URLs
  - Added react-i18next with English and Vietnamese locale files
  - Added language switcher (EN/VI) in the user menu with localStorage persistence
  - Localized Data Marts overview hints and actions to match the selected language
  - Increased organization/project creation limit from 20 to 50

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

## 0.18.0

### Patch Changes 0.18.0

- @owox/internal-helpers@0.18.0
- @owox/idp-protocol@0.18.0

## 0.17.0

### Patch Changes 0.17.0

- @owox/internal-helpers@0.17.0
- @owox/idp-protocol@0.17.0

## 0.16.0

### Patch Changes 0.16.0

- @owox/internal-helpers@0.16.0
- @owox/idp-protocol@0.16.0

## 0.15.0

### Patch Changes 0.15.0

- @owox/internal-helpers@0.15.0
- @owox/idp-protocol@0.15.0

## 0.14.0

### Patch Changes 0.14.0

- @owox/internal-helpers@0.14.0
- @owox/idp-protocol@0.14.0

## 0.13.0

### Patch Changes 0.13.0

- @owox/internal-helpers@0.13.0
- @owox/idp-protocol@0.13.0

## 0.12.0

### Patch Changes 0.12.0

- @owox/internal-helpers@0.12.0
- @owox/idp-protocol@0.12.0

## 0.11.0

### Patch Changes 0.11.0

- @owox/internal-helpers@0.11.0
- @owox/idp-protocol@0.11.0

## 0.10.0

### Patch Changes 0.10.0

- @owox/internal-helpers@0.10.0
- @owox/idp-protocol@0.10.0

## 0.9.0

### Patch Changes 0.9.0

- @owox/internal-helpers@0.9.0
- @owox/idp-protocol@0.9.0

## 0.8.0

### Patch Changes 0.8.0

- @owox/internal-helpers@0.8.0
- @owox/idp-protocol@0.8.0

## 0.7.0

### Patch Changes 0.7.0

- @owox/idp-protocol@0.7.0

## 0.6.0

### Patch Changes 0.6.0

- @owox/idp-protocol@0.6.0
