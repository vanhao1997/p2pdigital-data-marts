import { ProjectNotificationSettings } from '../entities/project-notification-settings.entity';
import { NotificationType } from '../enums/notification-type.enum';
import { ProjectNotificationSettingsService } from './project-notification-settings.service';

describe('ProjectNotificationSettingsService', () => {
  it('does not overwrite a stored webhook when the API masked value is submitted back', async () => {
    const storedWebhook =
      'https://chat.googleapis.com/v1/spaces/AAA/messages?key=google-api-key&token=google-webhook-token';
    const settings = Object.assign(new ProjectNotificationSettings(), {
      id: 'setting-1',
      projectId: 'project-1',
      notificationType: NotificationType.SUCCESSFUL_RUNS_ALL_DM,
      enabled: false,
      receivers: [],
      optedOutReceivers: [],
      webhookUrl: storedWebhook,
      groupingDelayCron: '0 * * * *',
      lastRunAt: null,
      nextRunAt: null,
    });
    const repository = {
      findOne: jest.fn().mockResolvedValue(settings),
      save: jest.fn(async value => value),
    };
    const service = new ProjectNotificationSettingsService(repository as never);

    await service.upsert('project-1', NotificationType.SUCCESSFUL_RUNS_ALL_DM, {
      webhookUrl:
        'https://chat.googleapis.com/v1/spaces/_redacted_/messages?key=REDACTED&token=REDACTED',
    });

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ webhookUrl: storedWebhook })
    );
  });
});
