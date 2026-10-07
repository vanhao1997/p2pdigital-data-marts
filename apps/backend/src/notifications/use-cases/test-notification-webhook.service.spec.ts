import { NotificationType } from '../enums/notification-type.enum';
import { TestNotificationWebhookService } from './test-notification-webhook.service';

describe('TestNotificationWebhookService', () => {
  it('resolves a masked API value back to the stored webhook secret', async () => {
    const storedWebhook =
      'https://chat.googleapis.com/v1/spaces/AAA/messages?key=google-api-key&token=google-webhook-token';
    const settingsService = {
      findByProjectIdAndType: jest.fn().mockResolvedValue({ webhookUrl: storedWebhook }),
    };
    const webhookService = {
      sendTestWebhook: jest.fn().mockResolvedValue(undefined),
    };
    const tenantGuard = { assertHttpProject: jest.fn() };
    const service = new TestNotificationWebhookService(
      settingsService as never,
      webhookService as never,
      tenantGuard as never
    );

    await service.run({
      projectId: 'project-1',
      notificationType: NotificationType.SUCCESSFUL_RUNS_ALL_DM,
      webhookUrl:
        'https://chat.googleapis.com/v1/spaces/_redacted_/messages?key=REDACTED&token=REDACTED',
      userId: 'user-1',
      projectTitle: 'Project',
    });

    expect(webhookService.sendTestWebhook).toHaveBeenCalledWith(
      storedWebhook,
      NotificationType.SUCCESSFUL_RUNS_ALL_DM,
      'project-1',
      { userId: 'user-1', projectTitle: 'Project' }
    );
  });
});
