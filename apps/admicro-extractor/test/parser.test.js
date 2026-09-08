import { describe, expect, it } from 'vitest';
import { normalizeCell, parseCampaignIds, parseDataview } from '../src/parser.js';

describe('Admicro DATAVIEW parser', () => {
  it('parses JSON-string payload and removes total rows', () => {
    const parsed = parseDataview(
      JSON.stringify({
        data_rpt_campaign: [
          ['Campaign A', '1,234', '2.5%'],
          ['Total', '1,234', '2.5%'],
        ],
      }),
      'campaign'
    );
    expect(parsed.headers).toEqual(['Column 1', 'Column 2', 'Column 3']);
    expect(parsed.rows).toHaveLength(1);
  });

  it('normalizes Vietnamese and US numeric values without changing identifiers', () => {
    expect(normalizeCell('1,25')).toBe(1.25);
    expect(normalizeCell('1,234')).toBe(1234);
    expect(normalizeCell('1.234')).toBe(1234);
    expect(normalizeCell('0.033', { decimal: true })).toBe(0.033);
    expect(normalizeCell('1.234.567')).toBe(1234567);
    expect(normalizeCell('1.234,56')).toBe(1234.56);
    expect(normalizeCell('2.5%')).toBe(2.5);
    expect(normalizeCell('N/A')).toBeNull();
    expect(normalizeCell(123, { identifier: true })).toBe('123');
  });

  it('deduplicates campaign IDs', () => {
    expect(parseCampaignIds('1, 2 1;3')).toEqual(['1', '2', '3']);
  });

  it('finds a report array under an unknown DATAVIEW wrapper key', () => {
    const parsed = parseDataview({ providerPayload: [['Campaign A', '12']] }, 'campaign');
    expect(parsed.rows).toEqual([['Campaign A', '12']]);
  });

  it('deduplicates identical rows without changing row order', () => {
    const parsed = parseDataview(
      {
        data_rpt_campaign: [
          ['Campaign A', '12'],
          ['Campaign A', '12'],
          ['Campaign B', '34'],
        ],
      },
      'campaign'
    );

    expect(parsed.rows).toEqual([
      ['Campaign A', '12'],
      ['Campaign B', '34'],
    ]);
  });
});
