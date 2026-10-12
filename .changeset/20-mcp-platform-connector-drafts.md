---
'@owox/backend': minor
'@owox/web': minor
---

# Create and configure platform connector drafts through MCP

MCP clients can use `create_connector` and `configure_connector` to prepare Data Marts with installed platform providers, including Facebook Ads, Google Ads, TikTok Ads and LinkedIn Ads. Clients discover the provider's exact nodes and fields before saving a connector, and receive the Data Mart ID and web setup URL.

Connector drafts enforce project permissions and reject unsupported catalog selections and plaintext credentials. OAuth and token entry remain in the authenticated web application. Creating or configuring a connector does not validate, publish, start a sync or create a schedule; existing published schedules remain unchanged.

The MCP guide includes a platform-neutral connector setup prompt. Existing web-created connector definitions with dynamic fields retain their validation and publishing behavior.

Refs #20.
