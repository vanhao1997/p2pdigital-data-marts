---
title: Project administration
description: Manage members, roles, contexts, configuration variables, API keys, and notifications.
---

## Members and roles

Invite members from **Project settings → Members** and grant the lowest role that supports the
person's work. Viewers can read permitted data, editors can change the configurations allowed by
their role, and admins manage members, contexts, and project settings.

## Ownership and contexts

Contexts group data or members around an organizational workflow. Before sharing a Data Mart,
check the selected project, owner, and applied context. A context does not replace role checks.

## Configuration variables

Create variables in **Project settings → Variables**. Use `secret_reference` or
`credential_reference` for sensitive values. Never paste tokens into descriptions, screenshots, or
tickets. Variables are resolved only when a run has the required permission, and secret metadata is
masked in the UI.

## API keys

An API key secret is shown only once. Choose the smallest role the integration needs, enable
read-only access for jobs that must not mutate data, set an expiry, and revoke keys when no longer
needed. Store the secret in the integration's secret manager rather than source control. See the
[API key guide](api/api-keys.md).

## Notifications and webhooks

Subscribe only to the events you need in **Project settings → Notifications**. Use an HTTPS endpoint,
verify signatures when the provider supports them, and test a webhook before enabling a production
schedule. When rotating a secret, rotate it on both the receiving system and P2PDigital in the same
maintenance window.
