---
'owox': minor
---

# Safe Coolify healthchecks and SQLite rollout

Coolify deployment uses image-bundled Node healthcheck scripts that work in the slim runtime image without curl, wget, inline JavaScript commands, or host-mounted files. The generated command stays within Coolify's restricted healthcheck command pattern and performs an exact HTTP 200 check with a four-second timeout.

Both runtime images are self-contained. The probes respect the configured runtime port and reject redirects, invalid ports, non-200 responses, and timed-out requests. Operators upgrading from a host-mounted healthcheck must switch to the bundled command only after deploying an image that includes it.

Automated rolling deployment stops before changing resources when application, plugin collection or native authentication storage uses SQLite or an unknown/default configuration. SQLite operators must use a controlled stopped-writer rollout with a fresh backup.

Refs #19.
