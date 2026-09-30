---
title: Data Mart metric dictionary
description: Source, formula, grain, timezone, and refresh contract for Data Mart metrics.
---

The definitions below are the data contract for project dashboard metrics. Show a metric only
when its source is available; `Unavailable` must never be interpreted as `0`.

| Metric          | Source and formula                                                                                                                                                                                                                    | Grain                                 | Timezone                                                     | Refresh                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| Data Mart count | `COUNT(data_mart.id)` where `data_mart.projectId = projectId` and `deletedAt IS NULL`; includes `DRAFT` and `PUBLISHED`.                                                                                                              | One project at query time.            | Counts have no timezone; snapshot time is UTC.               | Each list load or refresh.                                   |
| Published count | The same Data Mart set with `status = 'PUBLISHED'`. Do not infer publish time from `modifiedAt`.                                                                                                                                      | One project at query time.            | Counts have no timezone; snapshot time is UTC.               | Each list load or refresh.                                   |
| Run errors      | `COUNT(data_mart_run.id)` where `status IN ('FAILED', 'INTERRUPTED', 'RESTRICTED')`, scoped through the project's Data Marts and the selected `createdAt` range.                                                                      | One run, one project, one time range. | Stored and filtered in UTC; rendered in the user's timezone. | After a run finishes and the list refreshes.                 |
| Run warnings    | There is no persisted `WARNING` status in `DataMartRunStatus`. Do not search `logs` or `errors` for warning strings; add a structured taxonomy first.                                                                                 | Not available.                        | Not applicable.                                              | Not available.                                               |
| Last updated    | `data_mart.dataLastUpdated.dataLastUpdatedAt`: the latest change reported by any source table's warehouse metadata. `computedAt` is the measurement time, not the data-change time. Trust it fully only when `coverage = 'complete'`. | One Data Mart and its source set.     | ISO UTC timestamp; rendered in the user's timezone.          | Snapshot refresh requested by a user; no fixed sync cadence. |
| Data freshness  | `now - dataLastUpdatedAt`, compared with the configured scope threshold when coverage is complete and the timestamp is valid. `partial` and `unavailable` stay distinct.                                                              | One Data Mart at evaluation time.     | Calculated in UTC; formatted in the user's timezone.         | When the snapshot or threshold changes.                      |
| API freshness   | No common sync timestamp exists for every connector. Do not infer it from an HTTP response, `modifiedAt`, or page load. Add `lastSuccessfulSyncAt`, cadence, and retry state to a connector before shipping this metric.              | One connector in one project.         | UTC; rendered in the user's timezone.                        | On each connector's successful sync.                         |

The dashboard must distinguish `loading`, `no data`, `not configured`, `stale data`,
`connector error`, `permission denied`, and `unavailable`. `No data` means the query succeeded
with an empty result; `unavailable` means the system could not determine the value.

Operational log metrics are not billing metrics. See the
[observability contract](../getting-started/deployment-guide/observability.md) for the source and
limits of each counter.
