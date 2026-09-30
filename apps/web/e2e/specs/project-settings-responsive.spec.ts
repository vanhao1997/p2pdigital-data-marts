import { test, expect } from '../fixtures/base';

test.describe('Project Settings responsive navigation', () => {
  test('keeps supported viewports within the viewport and exposes route semantics', async ({
    page,
  }) => {
    test.setTimeout(90_000);

    for (const width of [320, 375, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/ui/0/project-settings/members');

      await expect(page.locator('nav').first()).toBeVisible({ timeout: 30_000 });
      const metrics = await page.evaluate(() => ({
        innerWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(metrics.scrollWidth, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(
        metrics.innerWidth
      );
      expect(await page.locator('[role="tablist"]').count()).toBe(0);
      expect(await page.locator('a[aria-current="page"]').count()).toBeGreaterThan(0);
    }
  });
});
