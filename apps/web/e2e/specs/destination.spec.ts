import { test, expect } from '../fixtures/base';
import { TESTIDS } from '../selectors/testids';
import { describeIfCredentials } from '../helpers/credentials';
import { createGoogleSheetsDestination } from '../fixtures/google-sheets-destination';

// Budget includes API fixture work and cold route loading; assertions keep their
// original timeout and local runs do not retry failures.
test.setTimeout(90_000);

// ---------------------------------------------------------------------------
// DEST-01: Empty state renders on DM Destinations tab for a fresh datamart.
// Deletes all existing destinations via API first (Phase 9 cleanup pattern).
// ---------------------------------------------------------------------------
test.describe('Destinations - Empty State', () => {
  test('shows empty state on fresh DM (DEST-01)', async ({ page, apiHelpers }) => {
    // Include API cleanup and cold route loading in the test budget.
    // The assertion timeout remains unchanged.
    test.setTimeout(90_000);
    // Clean up ALL existing reports first (destinations with reports
    // cannot be deleted -- backend throws BusinessViolationException).
    const reportsRes = await page.request.get('/api/reports');
    if (reportsRes.ok()) {
      const reports = (await reportsRes.json()) as { id: string }[];
      for (const report of reports) {
        await page.request.delete(`/api/reports/${report.id}`);
      }
    }

    // Now clean up ALL existing destinations so the DM tab shows empty state.
    // The GET /api/data-destinations endpoint returns a plain array.
    const listRes = await page.request.get('/api/data-destinations');
    if (listRes.ok()) {
      const destinations = (await listRes.json()) as { id: string }[];
      for (const dest of destinations) {
        await page.request.delete(`/api/data-destinations/${dest.id}`);
      }
    }

    const storage = await apiHelpers.createStorage();
    const dm = await apiHelpers.createDataMart(storage.id);

    // The Destinations tab route is /reports (legacy naming)
    await page.goto(`/ui/0/data-marts/${dm.id}/reports`);
    await expect(page.getByTestId(TESTIDS.destTab)).toBeVisible();

    // EmptyDataMartDestinationsState renders "Go to Destinations" link
    // (does NOT use destEmptyState testid -- that is on standalone page)
    await expect(page.getByText('Go to Destinations')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// DEST-02..06: Destination CRUD per type (parameterized)
// Configuration is license-independent; only Report Run execution needs a license.
// ---------------------------------------------------------------------------
const DESTINATION_TYPES = [
  { type: 'LOOKER_STUDIO', label: 'Data Studio', prefix: 'LS' },
  { type: 'EMAIL', label: 'Email', prefix: 'Email' },
  { type: 'MS_TEAMS', label: 'Microsoft Teams', prefix: 'Teams' },
  { type: 'GOOGLE_CHAT', label: 'Google Chat', prefix: 'Chat' },
] as const;

for (const { type, label, prefix } of DESTINATION_TYPES) {
  test.describe(`Destinations - ${label} CRUD`, () => {
    let datamartId: string;
    let destTitle: string;

    test.beforeEach(async ({ apiHelpers }) => {
      const { datamart } = await apiHelpers.createPublishedDataMart();
      datamartId = datamart.id;
      destTitle = `${label} Dest ${Date.now()}`;
      await apiHelpers.createDestination(type, destTitle);
    });

    test(`renders ${label} destination card on DM tab`, async ({ page }) => {
      await page.goto(`/ui/0/data-marts/${datamartId}/reports`);
      const destTab = page.getByTestId(TESTIDS.destTab);
      await expect(destTab).toBeVisible();

      const card = destTab.getByTestId(TESTIDS.destCard).filter({ hasText: destTitle });
      await expect(card).toBeVisible();
    });

    test(`edits ${label} destination title`, async ({ page }) => {
      await page.goto('/ui/0/data-destinations');
      await expect(page.getByTestId(TESTIDS.destTab)).toBeVisible();

      await page.getByText(destTitle).click();
      const sheet = page.getByTestId(TESTIDS.destEditSheet);
      await expect(sheet).toBeVisible();

      const titleInput = sheet.getByLabel('Title');
      await expect(titleInput).toHaveValue(destTitle);
      await titleInput.fill('');
      const updatedTitle = `Updated ${prefix} ${Date.now()}`;
      await titleInput.fill(updatedTitle);

      await expect(titleInput).toHaveValue(updatedTitle);
      const saveButton = sheet.getByRole('button', { name: 'Save' });
      await expect(saveButton).toBeEnabled();
      await saveButton.click();
      await expect(sheet).not.toBeVisible();

      await expect(page.getByText(updatedTitle)).toBeVisible();
    });

    if (type === 'GOOGLE_CHAT') {
      test('preserves a legacy Google Chat channel email when editing the title', async ({
        page,
        apiHelpers,
      }) => {
        const legacyEmail = 'legacy-space@example.com';
        const legacyTitle = `Legacy Google Chat ${Date.now()}`;
        const destination = await apiHelpers.createDestination('GOOGLE_CHAT', legacyTitle, {
          type: 'email-credentials',
          to: [legacyEmail],
        });

        await page.goto('/ui/0/data-destinations');
        await page.getByText(legacyTitle).click();

        const sheet = page.getByTestId(TESTIDS.destEditSheet);
        await sheet.getByLabel('Title').fill(`Updated ${legacyTitle}`);
        await sheet.getByRole('button', { name: 'Save' }).click();
        await expect(sheet).not.toBeVisible();

        const response = await page.request.get(`/api/data-destinations/${destination.id}`);
        expect(response.ok()).toBeTruthy();
        expect((await response.json()).credentials).toEqual({
          type: 'email-credentials',
          to: [legacyEmail],
        });
      });
    }

    test(`deletes ${label} destination`, async ({ page, radix }) => {
      await page.goto('/ui/0/data-destinations');
      await expect(page.getByTestId(TESTIDS.destTab)).toBeVisible();

      await expect(page.getByText(destTitle)).toBeVisible();

      const row = page.locator('tr', { hasText: destTitle });
      await row.getByRole('button', { name: 'Open menu' }).click();
      await page.getByRole('menuitem', { name: 'Delete' }).click();
      await radix.confirmDialog('Delete');

      await expect(page.getByText(destTitle)).not.toBeVisible();
    });
  });
}

// ---------------------------------------------------------------------------
// DEST-07/08: Google Sheets persisted destination CRUD (no Google calls)
// ---------------------------------------------------------------------------
test.describe('Destinations - Google Sheets CRUD (DEST-07/08)', () => {
  test('edits Google Sheets destination title (DEST-07)', async ({ page, apiHelpers }) => {
    const originalTitle = `GSheets Edit ${Date.now()}`;
    const destination = await createGoogleSheetsDestination(page, apiHelpers, originalTitle);
    const destinationPath = `/api/data-destinations/${destination.id}`;

    await page.goto('/ui/0/data-destinations');
    await expect(page.getByTestId(TESTIDS.destTab)).toBeVisible();
    const originalRow = page.locator('tr', { hasText: originalTitle });
    await expect(originalRow).toBeVisible();
    await expect(originalRow).toContainText('Google Sheets');
    await originalRow.getByText(originalTitle, { exact: true }).click();

    const sheet = page.getByTestId(TESTIDS.destEditSheet);
    await expect(sheet).toBeVisible();
    await expect(sheet.getByLabel('Title')).toHaveValue(originalTitle);
    const updatedTitle = `GSheets Updated ${Date.now()}`;
    await sheet.getByLabel('Title').fill(updatedTitle);
    const updateResponse = page.waitForResponse(
      response => response.url().endsWith(destinationPath) && response.request().method() === 'PUT'
    );
    await sheet.getByRole('button', { name: 'Save' }).click();
    expect((await updateResponse).status()).toBe(200);
    await expect(sheet).not.toBeVisible();

    const updatedRow = page.locator('tr', { hasText: updatedTitle });
    await expect(updatedRow).toBeVisible();
    await expect(originalRow).not.toBeVisible();
    const persistedResponse = await page.request.get(destinationPath);
    expect(persistedResponse.status()).toBe(200);
    expect(await persistedResponse.json()).toMatchObject({
      id: destination.id,
      title: updatedTitle,
      type: 'GOOGLE_SHEETS',
      projectId: '0',
      credentialId: destination.credentialId,
    });

    await page.reload();
    await expect(updatedRow).toBeVisible();
    await expect(originalRow).not.toBeVisible();
  });

  test('deletes Google Sheets destination (DEST-08)', async ({ page, apiHelpers, radix }) => {
    const title = `GSheets Delete ${Date.now()}`;
    const destination = await createGoogleSheetsDestination(page, apiHelpers, title);
    const destinationPath = `/api/data-destinations/${destination.id}`;

    await page.goto('/ui/0/data-destinations');
    await expect(page.getByTestId(TESTIDS.destTab)).toBeVisible();
    const row = page.locator('tr', { hasText: title });
    await expect(row).toBeVisible();
    await expect(row).toContainText('Google Sheets');
    await row.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();

    const dialog = radix.confirmationDialog();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Delete Destination' })).toBeVisible();
    const deleteResponse = page.waitForResponse(
      response =>
        response.url().endsWith(destinationPath) && response.request().method() === 'DELETE'
    );
    await radix.confirmDialog('Delete');
    expect((await deleteResponse).status()).toBe(200);
    await expect(dialog).not.toBeVisible();
    await expect(row).not.toBeVisible();
    const deletedResponse = await page.request.get(destinationPath);
    expect(deletedResponse.status()).toBe(404);

    await page.reload();
    await expect(page.getByTestId(TESTIDS.destTab)).toBeVisible();
    await expect(row).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// DEST-04: Google Sheets destination creation (credential-gated)
// ---------------------------------------------------------------------------
describeIfCredentials(
  ['GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON'],
  'Destinations - Google Sheets CRUD (DEST-04)',
  () => {
    test('creates Google Sheets destination via UI (DEST-04)', async ({ page }) => {
      await page.goto('/ui/0/data-destinations');
      await expect(page.getByTestId(TESTIDS.destTab)).toBeVisible();

      // Click "New Destination" button
      await page.getByTestId(TESTIDS.destCreateButton).click();

      const sheet = page.getByTestId(TESTIDS.destEditSheet);
      await expect(sheet).toBeVisible();

      // Title is pre-filled with "New Destination"; update it
      const titleInput = sheet.getByLabel('Title');
      await titleInput.fill('');
      const gsTitle = `GSheets Dest ${Date.now()}`;
      await titleInput.fill(gsTitle);

      // Google Sheets is the default type, so no need to change type select

      // Save
      await sheet.getByRole('button', { name: 'Save' }).click();
      await expect(sheet).not.toBeVisible();

      // Verify destination appears
      await expect(page.getByText(gsTitle)).toBeVisible();
    });
  }
);
