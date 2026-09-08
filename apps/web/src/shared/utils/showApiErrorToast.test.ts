import { describe, it, expect, beforeEach, vi } from 'vitest';
import { toast } from 'sonner';
import { showApiErrorToast } from './showApiErrorToast';

vi.mock('sonner', () => ({
  __esModule: true,
  default: { error: vi.fn(), dismiss: vi.fn() },
  toast: { error: vi.fn(), dismiss: vi.fn() },
}));

const mockedToastError = vi.mocked(toast.error);

/** Builds an axios-like error carrying the given response body. */
function axiosError(data: unknown) {
  return { response: { data } };
}

describe('showApiErrorToast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a localized primary message and keeps the server message diagnostic', () => {
    showApiErrorToast(axiosError({ message: 'Server says no' }));
    expect(mockedToastError).toHaveBeenCalledWith('Something went wrong', {
      description: 'Server says no',
    });
  });

  it('falls back when the error has no response body', () => {
    expect(() => {
      showApiErrorToast({});
    }).not.toThrow();
    expect(mockedToastError).toHaveBeenCalledWith('Something went wrong');
  });

  it('falls back when the server message is empty or whitespace', () => {
    showApiErrorToast(axiosError({ message: '   ' }), 'Custom fallback');
    expect(mockedToastError).toHaveBeenCalledWith('Custom fallback');
  });

  it('keeps error details in the diagnostic description', () => {
    showApiErrorToast(axiosError({ message: 'Denied', errorDetails: { error: 'extra info' } }));
    expect(mockedToastError).toHaveBeenCalledWith('Something went wrong', {
      description: 'Denied extra info',
    });
  });

  it('appends the validator message from details.errors', () => {
    showApiErrorToast(
      axiosError({
        message: 'Output controls validation failed',
        details: {
          errors: [
            {
              code: 'HAVING_ON_BLENDED_SLEEVE_METRIC_NOT_SUPPORTED',
              column: 'orders__amount',
              function: 'SUM',
              message: 'Filter on a main-side column or a different metric instead.',
            },
          ],
        },
      })
    );
    expect(mockedToastError).toHaveBeenCalledWith('Something went wrong', {
      description:
        'Output controls validation failed Filter on a main-side column or a different metric instead.',
    });
  });

  it('names the column and rule when an error carries no message', () => {
    showApiErrorToast(
      axiosError({
        message: 'Output controls validation failed',
        details: {
          errors: [
            { code: 'AGGREGATION_FUNCTION_NOT_ALLOWED_FOR_FIELD', column: 'name', function: 'P50' },
          ],
        },
      })
    );
    // The raw enum used to be shown verbatim. It is the code's own words, so a generic
    // de-screaming transform reads as a sentence for every code — including ones added later,
    // which a lookup table would silently render raw again.
    expect(mockedToastError).toHaveBeenCalledWith('Something went wrong', {
      description:
        'Output controls validation failed Aggregation function not allowed for field: P50(name).',
    });
  });

  // The validator reports EVERY problem in one array, and a persistent toast stays until
  // dismissed — an unbounded list turns it into a wall of text.
  it('lists the first few problems and counts the rest', () => {
    showApiErrorToast(
      axiosError({
        message: 'Rejected',
        details: {
          errors: [
            { code: 'A_RULE', column: 'one' },
            { code: 'B_RULE', column: 'two' },
            { code: 'C_RULE', column: 'three' },
            { code: 'D_RULE', column: 'four' },
            { code: 'E_RULE', column: 'five' },
          ],
        },
      })
    );

    const shown = mockedToastError.mock.calls[0][1]?.description as string;
    expect(shown).toContain('A rule: one.');
    expect(shown).toContain('C rule: three.');
    expect(shown).not.toContain('four');
    expect(shown).toContain('(+2 more)');
  });

  it('de-duplicates repeated validator messages', () => {
    showApiErrorToast(
      axiosError({
        message: 'Rejected',
        details: {
          errors: [
            { code: 'X', column: 'a', message: 'same reason' },
            { code: 'X', column: 'b', message: 'same reason' },
          ],
        },
      })
    );
    expect(mockedToastError).toHaveBeenCalledWith('Something went wrong', {
      description: 'Rejected same reason',
    });
  });

  it('reuses the given toast id so repeated failures do not stack', () => {
    showApiErrorToast(axiosError({ message: 'Server exploded' }), undefined, {
      id: 'server-error:500',
    });
    expect(mockedToastError).toHaveBeenCalledWith('Something went wrong', {
      id: 'server-error:500',
      description: 'Server exploded',
    });
  });

  it('redacts credentials and provider identifiers from diagnostics', () => {
    showApiErrorToast(
      axiosError({
        message:
          'authorization=Bearer EASecretToken123456789 act_123456789012 https://provider.test/path',
      })
    );

    const description = mockedToastError.mock.calls[0][1]?.description as string;
    expect(description).toContain('authorization=[redacted]');
    expect(description).toContain('[redacted account]');
    expect(description).toContain('[redacted URL]');
    expect(description).not.toContain('EASecretToken123456789');
    expect(description).not.toContain('123456789012');
  });

  describe('persistent option', () => {
    it('creates a never-expiring toast deduped by message', () => {
      showApiErrorToast(axiosError({ message: 'Denied' }), undefined, { persistent: true });
      expect(mockedToastError).toHaveBeenCalledWith('Something went wrong', {
        duration: Infinity,
        id: 'persistent-error:Something went wrong',
        description: 'Denied',
      });
    });

    it('passes message as string for persistent toast', () => {
      showApiErrorToast(axiosError({ message: 'Denied' }), undefined, { persistent: true });

      expect(mockedToastError).toHaveBeenCalledWith(
        'Something went wrong',
        expect.objectContaining({
          duration: Infinity,
          description: 'Denied',
        })
      );
    });
  });
});
