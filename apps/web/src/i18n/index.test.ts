import { describe, it, expect, beforeEach } from 'vitest';
import i18n, { LANGUAGE_STORAGE_KEY } from './index';
import en from './locales/en.json';
import vi from './locales/vi.json';

function flattenTranslations(value: unknown, prefix = '', output: Record<string, string> = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return output;
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof child === 'string') output[path] = child;
    else flattenTranslations(child, path, output);
  }
  return output;
}

describe('i18n configuration & language switching', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    localStorage.removeItem(LANGUAGE_STORAGE_KEY);
  });

  it('initializes with supported languages en and vi', () => {
    expect(i18n.options.supportedLngs).toContain('en');
    expect(i18n.options.supportedLngs).toContain('vi');
  });

  it('switches language to Vietnamese and resolves translations', async () => {
    await i18n.changeLanguage('vi');
    expect(i18n.language).toBe('vi');
    expect(i18n.t('userMenu.language')).toBe('Ngôn ngữ');
    expect(i18n.t('sidebar.runHistory')).toBe('Lịch sử chạy');
    expect(i18n.t('actionButton.newDataMart')).toBe('Tạo Data Mart mới');
    expect(i18n.t('projectMenu.switchProject')).toBe('Chuyển dự án');
  });

  it('switches back to English and resolves translations', async () => {
    await i18n.changeLanguage('en');
    expect(i18n.language).toBe('en');
    expect(i18n.t('userMenu.language')).toBe('Language');
    expect(i18n.t('sidebar.runHistory')).toBe('Run History');
    expect(i18n.t('actionButton.newDataMart')).toBe('New Data Mart');
    expect(i18n.t('projectMenu.switchProject')).toBe('Switch project');
  });

  it('normalizes regional Vietnamese locale vi-VN to vi', async () => {
    await i18n.changeLanguage('vi-VN');
    expect(i18n.resolvedLanguage).toBe('vi');
    expect(i18n.t('userMenu.language')).toBe('Ngôn ngữ');
  });

  it('keeps English and Vietnamese locale schemas aligned', () => {
    expect(Object.keys(flattenTranslations(vi)).sort()).toEqual(
      Object.keys(flattenTranslations(en)).sort()
    );
  });

  it('does not fall back to English for Vietnamese help and status copy', () => {
    const english = flattenTranslations(en);
    const vietnamese = flattenTranslations(vi);
    const requiredTranslatedKeys = [
      'dataMartsOverview.sectionLabel',
      'dataMartDetailsPage.dataMartIdRequired',
      'dataMartDataSetup.storageTooltip',
      'runHistory.openDataMart',
      'schemaUi.unsupportedType',
      'reportsUi.loadFailed',
      'destinationsPage.tableAriaLabel',
      'storagesPage.tableAriaLabel',
      'facebookAuth.pageInsightsDelay',
      'storageHelp.bigQueryAuth.title',
      'projectOverview.businessContextDescription',
      'variablesPage.description',
    ];

    for (const key of requiredTranslatedKeys) {
      expect(vietnamese[key]).toBeTruthy();
      expect(vietnamese[key]).not.toBe(english[key]);
    }
  });
});
