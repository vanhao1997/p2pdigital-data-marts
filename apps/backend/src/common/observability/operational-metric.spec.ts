import { durationBucket, recordOperationalMetric } from './operational-metric';

describe('recordOperationalMetric', () => {
  it('emits only fixed metric fields', () => {
    const logger = { log: jest.fn() };
    recordOperationalMetric(logger, 'api_key_exchange', 'unauthorized');

    expect(JSON.parse(logger.log.mock.calls[0][0] as string)).toEqual({
      event: 'operational_metric',
      metric: 'api_key_exchange',
      outcome: 'unauthorized',
    });
  });

  it('rejects unreviewed labels, including credential-bearing values', () => {
    const logger = { log: jest.fn() };
    expect(() =>
      recordOperationalMetric(logger, 'api_key_exchange', 'access_token=secret' as 'success')
    ).toThrow('Invalid operational metric');
    expect(logger.log).not.toHaveBeenCalled();
  });

  it.each([
    [0, 'lt_1s'],
    [999, 'lt_1s'],
    [1_000, '1s_to_10s'],
    [9_999, '1s_to_10s'],
    [10_000, '10s_to_60s'],
    [59_999, '10s_to_60s'],
    [60_000, 'gte_60s'],
    [Number.NaN, 'lt_1s'],
  ] as const)('maps duration %s to bounded bucket %s', (durationMs, expected) => {
    expect(durationBucket(durationMs)).toBe(expected);
  });

  it('adds only the reviewed duration bucket when supplied', () => {
    const logger = { log: jest.fn() };
    recordOperationalMetric(logger, 'connector_sync', 'success', {
      durationBucket: durationBucket(2_000),
    });

    expect(JSON.parse(logger.log.mock.calls[0][0] as string)).toEqual({
      event: 'operational_metric',
      metric: 'connector_sync',
      outcome: 'success',
      durationBucket: '1s_to_10s',
    });
  });

  it('rejects an unreviewed duration bucket at runtime', () => {
    const logger = { log: jest.fn() };
    expect(() =>
      recordOperationalMetric(logger, 'connector_sync', 'success', {
        durationBucket: 'access_token=secret' as never,
      })
    ).toThrow('Invalid operational metric duration bucket');
    expect(logger.log).not.toHaveBeenCalled();
  });
});
