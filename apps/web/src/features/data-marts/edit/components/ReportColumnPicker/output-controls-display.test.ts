import { describe, it, expect } from 'vitest';
import { fieldLeafName, fieldDisplayLabel } from './output-controls-display';
import i18n from '../../../../../i18n';

describe('fieldLeafName', () => {
  it('returns the last dotted segment', () => {
    expect(fieldLeafName('orders.order_items.products.product_id')).toBe('product_id');
  });
  it('returns the whole name when there is no dot', () => {
    expect(fieldLeafName('email')).toBe('email');
  });
});

describe('fieldDisplayLabel', () => {
  it('prefers a non-empty alias', () => {
    expect(fieldDisplayLabel('Product ID', 'orders.x.product_id')).toBe('Product ID');
  });
  it('falls back to the leaf when alias is missing', () => {
    expect(fieldDisplayLabel(undefined, 'orders.x.product_id')).toBe('product_id');
  });
  it('ignores a whitespace-only alias', () => {
    expect(fieldDisplayLabel('   ', 'orders.x.product_id')).toBe('product_id');
  });
  it('handles a blended leaf basis (no dots)', () => {
    expect(fieldDisplayLabel(undefined, 'product_id')).toBe('product_id');
  });
  it('humanizes the fallback leaf in Vietnamese locale when alias is missing', async () => {
    const previousLanguage = i18n.language;
    await i18n.changeLanguage('vi');
    try {
      expect(fieldDisplayLabel(undefined, 'orders.x.product_id')).toBe('ID sản phẩm');
    } finally {
      await i18n.changeLanguage(previousLanguage);
    }
  });
});
