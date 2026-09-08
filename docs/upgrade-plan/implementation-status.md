# Webapp Optimization Implementation Status

## Delivered MVP

- Insight templates support title search, retryable loading failures, request cancellation, and cache refresh after mutations.
- Template deletion is blocked only while an associated run trigger is active (`IDLE`, `READY`, `PROCESSING`, or `CANCELLING`).
- Better Auth accounts can set, preview, and remove an HTTPS/HTTP avatar URL.
- GitHub Issues and GitHub Projects are the zero-cost replacement for Fibery task and roadmap tracking.

## Operating model

- Use GitHub Issues for incidents and feature work; add labels for `bug`, `ops`, `template`, and `connector`.
- Use a GitHub Project board with triage, ready, in progress, review, and done columns.
- Configure GitHub Actions for lint, typecheck, tests, and backend build on every pull request.
- Monitor API error rate, request latency, failed sync triggers, queue depth, and database backup age.

## V1 backlog

- Store avatar files in object storage with size/type validation and optional crop UI.
- Add template versions, draft/published state, restore, audit log, and optimistic locking.
- Add report dependency checks before deleting templates and browser E2E coverage for admin flows.
