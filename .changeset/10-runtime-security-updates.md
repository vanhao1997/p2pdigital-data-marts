---
'@owox/backend': minor
'@owox/connectors': minor
'owox': minor
---

Update production dependencies to address IP spoofing, denial-of-service, and SDK advisories. Snowflake connections use the current SDK, and local embedding search uses Transformers.js 4 with the same model and vector dimensions.

Refs #10.
