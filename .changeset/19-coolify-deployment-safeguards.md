---
'owox': minor
---

# Safe Coolify healthchecks and SQLite rollout

Coolify deployment uses Node-based healthchecks that work in the slim runtime image without curl or wget. Automated rolling deployment stops before changing resources when application, plugin collection or native authentication storage uses SQLite or an unknown/default configuration. SQLite operators must use a controlled stopped-writer rollout with a fresh backup.

Refs #19.
