# @owox/connectors

## 0.33.0

### Minor Changes 0.33.0

- f13fc57: Update runtime dependencies to address known security advisories in HTTP requests, gRPC certificate authorization, TOML parsing, and URI/query parsing. The HTTP and gRPC updates stay within the existing major versions, preserving integration compatibility.

  Pin the FTP dependency used by `get-uri` to `basic-ftp` 6.2.1 to address directory-listing denial of service, preserving the Databricks SQL client and proxy stack versions.

  FTP data connections now use the control host by default (`allowSeparateTransferHost: false`). The supported same-host FTP/PAC path is covered by runtime compatibility fixtures; deployments using a separate FTP transfer host require compatibility review before rollout.

  Deployment images use the verified dependency versions from the release lockfile, avoiding vulnerable packages inherited from an older runtime image. Image checks verify the installed dependency inventory and application readiness before publication.

- d706ab3: Update production dependencies to address IP spoofing, denial-of-service, and SDK advisories. Snowflake connections use the current SDK, and local embedding search uses Transformers.js 4 with the same model and vector dimensions.

  Refs #10.

- 264cdcf: Add stable Meta Marketing API metrics for Facebook Ads and replace deprecated
  Facebook Page/Post reach reporting with Page media-view and lifetime post media
  insights. New metrics remain optional and existing default selections stay unchanged.
- 820d349: # Add manual Facebook Ads credentials

  Facebook Ads setup now offers a dedicated Access Token option where users can enter an Access Token, App ID, and App Secret. OAuth and existing legacy token configurations remain supported.

- a55791f: Show a clear Facebook Ads reconnect action when every configured ad account is rejected for missing `ads_read` or `ads_management` permissions.

## 0.32.0

## 0.31.0

## 0.30.1

## 0.30.0

## 0.29.0

## 0.28.0

## 0.27.1

## 0.27.0

## 0.26.0

## 0.25.0

## 0.24.0

## 0.23.0

## 0.22.0

## 0.21.1

## 0.21.0

## 0.20.0

## 0.19.0

## 0.18.0

## 0.17.0

## 0.16.0

## 0.15.0

## 0.14.0

## 0.13.0

## 0.12.0

## 0.11.0

## 0.10.0

## 0.9.0

## 0.8.0

## 0.7.0

## 0.6.0

## 0.5.0

## 0.4.0

## 0.3.0

## 0.2.0
