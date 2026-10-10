import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import { test, expect } from '../fixtures/base';

function withTestDatabase(action: (db: SqliteDatabase) => void) {
  if (!process.env.SQLITE_DB_PATH) throw new Error('SQLITE_DB_PATH is required for test fixtures');
  const require = createRequire(import.meta.url);
  const Database = require('better-sqlite3') as typeof import('better-sqlite3');
  const db = new Database(resolve(process.env.SQLITE_DB_PATH));
  try {
    action(db);
  } finally {
    db.close();
  }
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test(`project overview and live sync count at ${viewport.width}px`, async ({
    page,
    apiHelpers,
  }, testInfo) => {
    test.setTimeout(90_000);
    await page.setViewportSize(viewport);
    const storage = await apiHelpers.createStorage();
    const marts: { id: string }[] = [];
    for (let i = 0; i < 7; i++)
      marts.push(
        await apiHelpers.createDataMart(
          storage.id,
          `Overview mart ${i} with a long project data title`
        )
      );
    const runningId = randomUUID();
    withTestDatabase(db => {
      db.prepare(
        "UPDATE data_mart SET definitionType = ?, definition = ?, createdAt = '2030-01-01 00:00:00' WHERE id = ?"
      ).run(
        'CONNECTOR',
        JSON.stringify({
          connector: {
            source: {
              name: 'AdmicroAds',
              configuration: [{ token: 'test-only-secret' }],
              node: 'metrics',
              fields: ['id'],
            },
            storage: { fullyQualifiedName: 'test.metrics' },
          },
        }),
        marts[6].id
      );
      // Older than the default run-history window: the summary must count all active runs.
      db.prepare(
        'INSERT INTO data_mart_run (id, dataMartId, type, status, runType, createdAt) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(runningId, marts[6].id, 'CONNECTOR', 'RUNNING', 'manual', '2020-01-01 00:00:00');
    });
    await page.goto('/projects');
    const project = page.getByRole('region', { name: 'P2PDigital Data Marts', exact: true });
    await expect(project.locator('dl').locator('div').nth(0).locator('dd')).toHaveText('7');
    await expect(project.getByRole('listitem').filter({ hasText: 'AdmicroAds' })).toBeVisible();
    await expect(project.locator('dl').locator('div').nth(2).locator('dd')).toHaveText('1');
    await expect(project.getByRole('button', { name: /View all/ })).toHaveText(
      'View all (+2 more)'
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`project-overview-${viewport.width}.png`),
      fullPage: true,
    });

    withTestDatabase(db => {
      db.prepare('UPDATE data_mart_run SET status = ? WHERE id = ?').run('SUCCESS', runningId);
    });
    await expect(project.locator('dl').locator('div').nth(2).locator('dd')).toHaveText('0', {
      timeout: 25_000,
    });
    await project
      .getByRole('button', { name: 'Overview mart 6 with a long project data title', exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/ui/0/data-marts/${marts[6].id}/overview$`));
  });
}
