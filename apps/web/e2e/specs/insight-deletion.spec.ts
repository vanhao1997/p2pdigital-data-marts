import { test, expect } from '../fixtures/base';

for (const view of ['list', 'details'] as const) {
  test(`keeps a report-linked insight and explains deletion failure from ${view}`, async ({
    page,
    apiHelpers,
  }) => {
    const { datamart } = await apiHelpers.createPublishedConnectorDataMart();
    const dataMartId = datamart.id;
    const templateResponse = await page.request.post(
      `/api/data-marts/${dataMartId}/insight-templates`,
      { data: { title: 'Protected insight', template: 'Report summary' } }
    );
    expect(templateResponse.ok()).toBe(true);
    const template = (await templateResponse.json()) as { id: string; title: string };
    const destination = await apiHelpers.createDestination('EMAIL');
    const reportResponse = await page.request.post('/api/reports', {
      data: {
        title: 'Linked insight report',
        dataMartId,
        dataDestinationId: destination.id,
        destinationConfig: {
          type: 'email-config',
          subject: 'Insight summary',
          templateSource: {
            type: 'INSIGHT_TEMPLATE',
            config: { insightTemplateId: template.id },
          },
          reportCondition: 'ALWAYS',
        },
      },
    });
    expect(reportResponse.ok()).toBe(true);
    const report = (await reportResponse.json()) as { id: string };
    const listUrl = `/ui/0/data-marts/${dataMartId}/insights`;
    const templateUrl = `/api/data-marts/${dataMartId}/insight-templates/${template.id}`;
    await page.goto(view === 'list' ? listUrl : `${listUrl}/${template.id}`);

    const openDeleteDialog = async () => {
      if (view === 'list') {
        const row = page.getByRole('row').filter({ hasText: template.title });
        await row.hover();
        await row.getByRole('button', { name: /Insight actions|Thao tác.*insight/i }).click();
      } else {
        await page.getByRole('button', { name: /Insight actions|Thao tác.*insight/i }).click();
      }
      await page.getByRole('menuitem', { name: /Delete insight|Xóa.*insight/i }).click();
      return page.getByRole('dialog').getByRole('button', { name: /^(Delete|Xóa)$/ });
    };

    const confirm = await openDeleteDialog();
    const blockedDeletion = page.waitForResponse(
      response =>
        new URL(response.url()).pathname === templateUrl && response.request().method() === 'DELETE'
    );
    await confirm.click();
    expect((await blockedDeletion).status()).toBe(400);
    await expect(page.locator('[data-sonner-toast]')).toContainText([
      'Cannot delete an insight template used by reports',
    ]);
    expect((await page.request.get(templateUrl)).ok()).toBe(true);
    expect((await page.request.get(`/api/reports/${report.id}`)).ok()).toBe(true);

    if (view === 'details') {
      const blockedDialog = page.getByRole('dialog');
      await expect(blockedDialog).toBeVisible();
      await page.keyboard.press('Escape');
    }
    await expect(page.getByRole('dialog')).toHaveCount(0);

    const unlinkReport = await page.request.delete(`/api/reports/${report.id}`);
    expect(unlinkReport.ok()).toBe(true);
    const confirmAfterUnlink = await openDeleteDialog();
    const successfulDeletion = page.waitForResponse(
      response =>
        new URL(response.url()).pathname === templateUrl && response.request().method() === 'DELETE'
    );
    await confirmAfterUnlink.click();
    expect((await successfulDeletion).ok()).toBe(true);
    expect((await page.request.get(templateUrl)).status()).toBe(404);
    await expect(page).toHaveURL(new RegExp(`${listUrl}$`));
    await expect(page.getByRole('row').filter({ hasText: template.title })).toHaveCount(0);
  });
}
