import { describe, expect, it } from 'vitest';
import {
  generateUniqueFieldAliases,
  humanizeFieldName,
  normalizeSearchText,
  tokenizeFieldName,
} from './field-humanizer';

describe('field-humanizer', () => {
  describe('tokenizeFieldName', () => {
    it('splits snake_case, kebab-case, camelCase, PascalCase, and strips leading underscores', () => {
      expect(tokenizeFieldName('campaign_name')).toEqual(['campaign', 'name']);
      expect(tokenizeFieldName('_owox_row_number')).toEqual(['owox', 'row', 'number']);
      expect(tokenizeFieldName('adGroupName')).toEqual(['ad', 'group', 'name']);
      expect(tokenizeFieldName('AdSetID')).toEqual(['ad', 'set', 'id']);
      expect(tokenizeFieldName('ad-account/insights')).toEqual(['ad', 'account', 'insights']);
    });
  });

  describe('humanizeFieldName (Vietnamese)', () => {
    it('translates exact dictionary fields into Vietnamese business labels', () => {
      expect(humanizeFieldName('campaign_name', { locale: 'vi' })).toBe('Tên chiến dịch');
      expect(humanizeFieldName('adset_id', { locale: 'vi' })).toBe('ID nhóm quảng cáo');
      expect(humanizeFieldName('stat_time_day', { locale: 'vi' })).toBe('Ngày thống kê');
      expect(humanizeFieldName('cpc', { locale: 'vi' })).toBe('CPC (Chi phí mỗi lượt nhấp)');
      expect(humanizeFieldName('ctr', { locale: 'vi' })).toBe('CTR (Tỷ lệ nhấp)');
      expect(humanizeFieldName('roas', { locale: 'vi' })).toBe(
        'ROAS (Lợi tức chi tiêu quảng cáo)'
      );
      expect(humanizeFieldName('_owox_row_number', { locale: 'vi' })).toBe(
        'Số thứ tự dòng (OWOX)'
      );
      expect(humanizeFieldName('_owox_imported_at', { locale: 'vi' })).toBe(
        'Thời điểm nhập dữ liệu (OWOX)'
      );
    });

    it('composes structural Vietnamese labels for compound fields not in exact dictionary', () => {
      expect(humanizeFieldName('partner_id', { locale: 'vi' })).toBe('ID đối tác');
      expect(humanizeFieldName('store_name', { locale: 'vi' })).toBe('Tên cửa hàng');
      expect(humanizeFieldName('payment_status', { locale: 'vi' })).toBe('Trạng thái thanh toán');
      expect(humanizeFieldName('payment_type', { locale: 'vi' })).toBe('Loại thanh toán');
      expect(humanizeFieldName('total_clicks', { locale: 'vi' })).toBe('Tổng lượt nhấp');
      expect(humanizeFieldName('avg_cost', { locale: 'vi' })).toBe('Chi phí trung bình');
      expect(humanizeFieldName('adGroupName', { locale: 'vi' })).toBe('Tên nhóm quảng cáo');
      expect(humanizeFieldName('AverageCartAllPc30dPv24h', { locale: 'vi' })).toBe(
        'Tổng giá trị giỏ hàng trung bình (30 ngày sau nhấp, 24 giờ sau xem)'
      );
      expect(humanizeFieldName('ConversionRatePc30d', { locale: 'vi' })).toBe(
        'Tỷ lệ chuyển đổi (30 ngày sau nhấp)'
      );
      expect(humanizeFieldName('viralExternalWebsitePostClickConversions', { locale: 'vi' })).toBe(
        'Lượt chuyển đổi trang web bên ngoài sau nhấp chuột lan truyền'
      );
      expect(humanizeFieldName('gmv_cost_per_10s_live_view', { locale: 'vi' })).toBe(
        'Chi phí (GMV) mỗi lượt xem 10 giây trực tiếp (Live)'
      );
      expect(humanizeFieldName('follower_counts_by_staff_count_range', { locale: 'vi' })).toBe(
        'Số lượng người theo dõi theo phạm vi quy mô nhân sự'
      );
      expect(humanizeFieldName('notifiedOnCreativeApproval', { locale: 'vi' })).toBe(
        'Thông báo khi phê duyệt mẫu quảng cáo'
      );
      expect(humanizeFieldName('is_smart_performance_campaign', { locale: 'vi' })).toBe(
        'Chiến dịch hiệu suất thông minh'
      );
    });

    it('supports includeTechnicalName option', () => {
      expect(
        humanizeFieldName('campaign_name', { locale: 'vi', includeTechnicalName: true })
      ).toBe('Tên chiến dịch (campaign_name)');
      expect(humanizeFieldName('id', { locale: 'vi', includeTechnicalName: true })).toBe(
        'ID (id)'
      );
    });

    it('handles dotted field paths with and without leafOnly', () => {
      expect(humanizeFieldName('orders.customer_id', { locale: 'vi' })).toBe(
        'Đơn hàng · ID khách hàng'
      );
      expect(humanizeFieldName('orders.customer_id', { locale: 'vi', leafOnly: true })).toBe(
        'ID khách hàng'
      );
    });
  });

  describe('humanizeFieldName (English)', () => {
    it('formats snake_case and camelCase into Title Case with uppercase acronyms', () => {
      expect(humanizeFieldName('campaign_name', { locale: 'en' })).toBe('Campaign Name');
      expect(humanizeFieldName('campaign_id', { locale: 'en' })).toBe('Campaign ID');
      expect(humanizeFieldName('inline_link_click_ctr', { locale: 'en' })).toBe(
        'Inline Link Click CTR'
      );
      expect(humanizeFieldName('_owox_row_number', { locale: 'en' })).toBe('OWOX Row Number');
      expect(humanizeFieldName('adGroupName', { locale: 'en' })).toBe('Ad Group Name');
    });
  });

  describe('generateUniqueFieldAliases', () => {
    it('generates humanized aliases for fields without alias and preserves existing aliases', () => {
      const fields = [
        { name: 'campaign_id' },
        { name: 'campaign_name', alias: 'Chiến dịch tùy chỉnh' },
        { name: 'clicks' },
      ];
      const aliases = generateUniqueFieldAliases(fields, 'vi');
      expect(aliases.get('campaign_id')).toBe('ID chiến dịch');
      expect(aliases.has('campaign_name')).toBe(false);
      expect(aliases.get('clicks')).toBe('Lượt nhấp');
    });

    it('disambiguates colliding generated aliases with technical field names', () => {
      const fields = [{ name: 'adset_id' }, { name: 'adgroup_id' }];
      const aliases = generateUniqueFieldAliases(fields, 'vi');
      expect(aliases.get('adset_id')).toBe('ID nhóm quảng cáo (adset_id)');
      expect(aliases.get('adgroup_id')).toBe('ID nhóm quảng cáo (adgroup_id)');
    });

    it('disambiguates when a generated alias collides with an existing user alias', () => {
      const fields = [
        { name: 'custom_col', alias: 'Chi phí' },
        { name: 'spend' },
      ];
      const aliases = generateUniqueFieldAliases(fields, 'vi');
      expect(aliases.get('spend')).toBe('Chi phí (spend)');
    });

    it('replaces raw technical default aliases (where alias === name) while preserving custom aliases', () => {
      const fields = [
        { name: 'campaign_id', alias: 'campaign_id' },
        { name: 'campaign_name', alias: 'Chiến dịch Q4' },
        { name: 'ctr', alias: 'ctr' },
      ];
      const aliases = generateUniqueFieldAliases(fields, 'vi');
      expect(aliases.get('campaign_id')).toBe('ID chiến dịch');
      expect(aliases.has('campaign_name')).toBe(false);
      expect(aliases.get('ctr')).toBe('CTR (Tỷ lệ nhấp)');
    });
  });

  describe('normalizeSearchText', () => {
    it('strips Vietnamese accents and normalizes separators for search matching', () => {
      expect(normalizeSearchText('Tên chiến dịch')).toBe('ten chien dich');
      expect(normalizeSearchText('Độ tuổi')).toBe('do tuoi');
      expect(normalizeSearchText('campaign_name')).toBe('campaign name');
    });
  });
});
