import { BusinessViolationException } from '../../common/exceptions/business-violation.exception';
import { ProjectOperationBlockedException } from '../../common/exceptions/project-operation-blocked.exception';
import { ProjectBlockedReason } from '../enums/project-blocked-reason.enum';
import {
  createOperationalErrorPayload,
  extractRunErrorMessage,
  sanitizeOperationalErrorMessage,
  serializeOperationalError,
} from './run-error-message';

describe('extractRunErrorMessage', () => {
  it.each([
    [JSON.stringify({ error: 'storage read failed' }), 'storage read failed'],
    [JSON.stringify({ message: 'worker failed' }), 'worker failed'],
    [JSON.stringify({ msg: 'delivery failed' }), 'delivery failed'],
    ['plain trigger failure', 'plain trigger failure'],
    [JSON.stringify({ detail: 'not supported' }), JSON.stringify({ detail: 'not supported' })],
  ])('extracts a readable run error from %s', (entry, expected) => {
    expect(extractRunErrorMessage(entry)).toBe(expected);
  });

  // A failed run's errors array also holds classified warnings, which carry their text
  // under `warning`. These entries reach customers through failure emails and MCP report
  // status, so falling through to the raw JSON leaks an escaped blob and a stack trace.
  it('reads a persisted connector warning entry', () => {
    const entry = JSON.stringify({
      type: 'addWarningToCurrentStatus',
      at: '2026-07-27T14:16:21.365Z',
      warning:
        'HttpRequestException: Error validating access token: Session has expired.\n    at FacebookMarketingSource._validateResponse (/app/index.cjs:436:11)',
    });

    const extracted = extractRunErrorMessage(entry);

    expect(extracted).toContain('Session has expired');
    expect(extracted).not.toContain('addWarningToCurrentStatus');
    expect(extracted.slice(0, 300)).not.toContain('{"type"');
  });

  it('reads a warning raised for a cancelled configuration', () => {
    const entry = JSON.stringify({
      type: 'addWarningToCurrentStatus',
      at: '2026-07-27T14:16:21.365Z',
      warning: 'Connector process was aborted',
    });

    expect(extractRunErrorMessage(entry)).toBe('Connector process was aborted');
  });

  it('reads the sanitized fallback from a structured operational error', () => {
    const entry = serializeOperationalError(new Error('authorization=Bearer secret-value'), {
      code: 'REPORT_RUN_FAILED',
      message: 'Report run failed',
      at: '2026-09-07T00:00:00.000Z',
    });

    expect(extractRunErrorMessage(entry)).toBe('authorization=[redacted]');
  });
});

describe('createOperationalErrorPayload', () => {
  it('uses a project restriction code without persisting project identifiers', () => {
    const payload = createOperationalErrorPayload(
      new ProjectOperationBlockedException([ProjectBlockedReason.OVERDRAFT_LIMIT_EXCEEDED]),
      {
        code: 'REPORT_RUN_FAILED',
        message: 'Report run failed',
        at: '2026-09-07T00:00:00.000Z',
        params: { projectId: 'project-secret', retryable: false },
      }
    );

    expect(payload).toEqual({
      type: 'error',
      at: '2026-09-07T00:00:00.000Z',
      taxonomyVersion: 1,
      provider: 'generic',
      category: 'billing',
      retryable: false,
      code: ProjectBlockedReason.OVERDRAFT_LIMIT_EXCEEDED,
      params: { retryable: false },
      message: expect.any(String),
    });
    expect(JSON.stringify(payload)).not.toContain('project-secret');
  });

  it('uses the first typed validation code and safe primitive parameters', () => {
    const error = new BusinessViolationException('Output controls validation failed', {
      errors: [
        {
          code: 'AGGREGATION_FUNCTION_NOT_ALLOWED_FOR_FIELD',
          column: 'revenue',
          function: 'P50',
          credentialId: 'credential-secret',
        },
      ],
    });

    expect(
      createOperationalErrorPayload(error, {
        code: 'REPORT_RUN_FAILED',
        message: 'Report run failed',
        at: '2026-09-07T00:00:00.000Z',
      })
    ).toMatchObject({
      code: 'AGGREGATION_FUNCTION_NOT_ALLOWED_FOR_FIELD',
      params: { column: 'revenue', function: 'P50' },
    });
  });

  it('redacts secrets, identifiers, URLs, stack traces, and SQL', () => {
    const sanitized = sanitizeOperationalErrorMessage(
      'authorization=Bearer secret-value act_123456789012 https://provider.test/a SELECT * FROM private_table\n    at worker (/app/file.js:1:1)',
      'Operation failed'
    );

    expect(sanitized).toContain('authorization=[redacted]');
    expect(sanitized).toContain('[redacted account]');
    expect(sanitized).toContain('[redacted URL]');
    expect(sanitized).toContain('[redacted query]');
    expect(sanitized).not.toContain('secret-value');
    expect(sanitized).not.toContain('private_table');
    expect(sanitized).not.toContain('/app/file.js');
  });

  it('classifies retryable provider failures without changing their stable code', () => {
    const payload = createOperationalErrorPayload(
      Object.assign(new Error('provider unavailable'), {
        code: 'GOOGLE_API_ERROR',
        statusCode: 503,
      }),
      {
        code: 'REPORT_RUN_FAILED',
        message: 'Report run failed',
        at: '2026-09-07T00:00:00.000Z',
      }
    );

    expect(payload).toMatchObject({
      taxonomyVersion: 1,
      provider: 'google',
      category: 'unavailable',
      retryable: true,
      code: 'GOOGLE_API_ERROR',
    });
  });
});
