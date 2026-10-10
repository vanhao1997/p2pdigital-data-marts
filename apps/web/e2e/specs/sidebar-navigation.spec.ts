import { test, expect } from '../fixtures/base';

test.describe('Sidebar navigation', () => {
  test('closes and reopens the mobile sidebar across navigation routes', async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/ui/0/data-marts');

    for (const [label, path] of [
      ['Data Marts', '/ui/0/data-marts'],
      ['Storages', '/ui/0/data-storages'],
      ['Reports', '/ui/0/data-marts/reports'],
      ['New Data Mart', '/ui/0/data-marts/create'],
      ['Search', '/ui/0/search'],
    ]) {
      await page.getByRole('button', { name: 'Toggle Sidebar', exact: true }).click();
      const sidebar = page.getByRole('dialog', { name: 'Sidebar', exact: true });
      await expect(sidebar).toBeVisible();

      await sidebar.getByRole('link', { name: new RegExp(`^${label}`) }).click();

      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(sidebar).not.toBeVisible();
      await expect(page.locator('main')).toBeVisible();
    }

    await page.screenshot({ path: testInfo.outputPath('sidebar-mobile.png') });
  });

  test('keeps the desktop sidebar expanded after navigation', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('sidebar_state', 'true');
    });
    await page.goto('/ui/0/data-marts');

    const sidebar = page.locator('[data-slot="sidebar"][data-state="expanded"]');
    await expect(sidebar).toBeVisible();
    await sidebar.getByRole('link', { name: 'Storages', exact: true }).click();

    await expect(page).toHaveURL(/\/ui\/0\/data-storages$/);
    await expect(sidebar).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Sidebar' })).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'Storages', exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('sidebar-desktop.png') });
  });
});
