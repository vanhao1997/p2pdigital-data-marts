---
'@owox/backend': minor
'owox': minor
---

# Create connections and author Data Marts through MCP

MCP clients can discover supported connectors and warehouse connections, create and configure storage using authorized credential references, and validate access. OAuth and manual credential entry stay in the authenticated web application; MCP does not accept or return plaintext credentials.

Clients can create draft Data Marts, update their titles, descriptions and definitions, validate setup, inspect setup status, and publish when explicitly requested. Publishing a connector Data Mart retains the existing automatic incremental-run behavior and may incur connector consumption. Creating or editing configuration does not run an extraction or report.

All new tools enforce the authenticated project, applicable roles and resource permissions in addition to OAuth scopes. Existing query, destination, report and schedule tools remain available.

Refs #20.
