import type { Logger } from '@nestjs/common';

/**
 * Low-cardinality operational facts for log-based metrics. Keep this contract
 * deliberately closed: request identifiers, tenant identifiers and error text
 * must never become metric labels or log fields.
 */
export const OPERATIONAL_METRIC_OUTCOMES = {
  api_key_exchange: ['success', 'unauthorized', 'rate_limited', 'failed'],
  oauth_registration: ['accepted', 'rejected', 'rate_limited', 'failed'],
  tenant_boundary: ['mismatch', 'missing_context'],
  billing_publish: ['accepted', 'rejected', 'skipped'],
  connector_sync: ['success', 'failed', 'interrupted', 'retry'],
  report_delivery: ['success', 'failed', 'cancelled', 'retry'],
  data_freshness: ['complete', 'partial', 'unavailable'],
} as const;

export const OPERATIONAL_DURATION_BUCKETS = [
  'lt_1s',
  '1s_to_10s',
  '10s_to_60s',
  'gte_60s',
] as const;

export type OperationalDurationBucket = (typeof OPERATIONAL_DURATION_BUCKETS)[number];

export function durationBucket(durationMs: number): OperationalDurationBucket {
  if (!Number.isFinite(durationMs) || durationMs < 1_000) return 'lt_1s';
  if (durationMs < 10_000) return '1s_to_10s';
  if (durationMs < 60_000) return '10s_to_60s';
  return 'gte_60s';
}

export type OperationalMetricName = keyof typeof OPERATIONAL_METRIC_OUTCOMES;
export type OperationalMetricOutcome<Name extends OperationalMetricName> =
  (typeof OPERATIONAL_METRIC_OUTCOMES)[Name][number];

export function recordOperationalMetric<Name extends OperationalMetricName>(
  logger: Pick<Logger, 'log'>,
  metric: Name,
  outcome: OperationalMetricOutcome<Name>,
  options?: { durationBucket?: OperationalDurationBucket }
): void {
  const allowedOutcomes = OPERATIONAL_METRIC_OUTCOMES[metric] as readonly string[] | undefined;
  if (!allowedOutcomes?.includes(outcome)) {
    throw new Error('Invalid operational metric');
  }

  if (
    options?.durationBucket !== undefined &&
    !OPERATIONAL_DURATION_BUCKETS.includes(options.durationBucket)
  ) {
    throw new Error('Invalid operational metric duration bucket');
  }

  // The logging transport supplies the timestamp. The payload contains only
  // fixed, reviewed values, so it can safely drive a log-based counter.
  logger.log(
    JSON.stringify({
      event: 'operational_metric',
      metric,
      outcome,
      ...(options?.durationBucket ? { durationBucket: options.durationBucket } : {}),
    })
  );
}
