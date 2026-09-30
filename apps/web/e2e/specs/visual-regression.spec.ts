import { test, expect } from '../fixtures/base';
import { resetDatabase } from '../fixtures/api-helpers';

// Run deliberately with VISUAL_REGRESSION=1 after building the test backend.
// The normal functional E2E suite stays focused on behavior and remains fast.
test.describe('Data Marts empty-state visual regression', () => {
  test.skip(!process.env.VISUAL_REGRESSION, 'Visual baselines run in the dedicated visual job');

  for (const width of [320, 375, 768, 1024, 1440]) {
    for (const theme of ['light', 'dark'] as const) {
      for (const locale of ['vi', 'en'] as const) {
        test(`${String(width)}px ${theme} ${locale}`, async ({ page }) => {
          resetDatabase();
          await page.setViewportSize({ width, height: 900 });
          await page.addInitScript(
            ({ selectedTheme, selectedLocale }) => {
              localStorage.setItem('theme', selectedTheme);
              localStorage.setItem('p2p_language', selectedLocale);
            },
            { selectedTheme: theme, selectedLocale: locale }
          );
          await page.goto('/ui/0/data-marts');
          const pageRoot = page.locator('.dm-page');
          await expect(pageRoot).toBeVisible();
          await expect(pageRoot).toHaveScreenshot(
            `data-marts-empty-${String(width)}-${theme}-${locale}.png`,
            {
              animations: 'disabled',
              caret: 'hide',
              maxDiffPixelRatio: 0.02,
            }
          );
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth)
          ).toBeLessThanOrEqual(width);
        });
      }
    }
  }
});
