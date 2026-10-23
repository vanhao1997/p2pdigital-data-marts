import type { FilterRule, RelativeDatePreset } from '../../../shared/types/output-config';
import { isVietnameseLocale } from '../../../../../shared/utils/field-humanizer';

const RELATIVE_PRESET_LABELS_VI: Record<RelativeDatePreset['kind'], string> = {
  today: 'Hôm nay',
  yesterday: 'Hôm qua',
  this_week: 'Tuần này',
  last_week: 'Tuần trước',
  this_month: 'Tháng này',
  last_month: 'Tháng trước',
  this_quarter: 'Quý này',
  last_quarter: 'Quý trước',
  this_year: 'Năm nay',
  last_n_days: '{{n}} ngày qua',
  last_n_months: '{{n}} tháng qua',
  next_n_days: '{{n}} ngày tới',
};

/**
 * Returns a short human-readable value string for a FilterRule to display
 * alongside the operator label (e.g. "contains: foo").
 * Returns an empty string for no-value operators (is_empty, is_null, etc.).
 */
export function summarizeFilterRule(rule: FilterRule): string {
  switch (rule.operator) {
    case 'is_empty':
    case 'is_not_empty':
    case 'is_null':
    case 'is_not_null':
    case 'is_true':
    case 'is_false':
      return '';
    case 'between':
      return `${String(rule.value.from)} … ${String(rule.value.to)}`;
    case 'in':
    case 'not_in':
      return rule.value.map(String).join(', ');
    case 'relative_date': {
      const v = rule.value;
      if (isVietnameseLocale()) {
        const template = RELATIVE_PRESET_LABELS_VI[v.kind];
        if ('n' in v) return template.replace('{{n}}', String(v.n));
        return template;
      }
      if ('n' in v) return v.kind.replace('_n_', ` ${String(v.n)} `);
      return v.kind;
    }
    default:
      return JSON.stringify(rule.value);
  }
}
