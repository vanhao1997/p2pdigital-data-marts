import { NotificationType } from '../enums/notification-type.enum';
import { ProjectNotificationSettings } from '../entities/project-notification-settings.entity';
import { NotificationSettingsMapper } from './notification-settings.mapper';

describe('NotificationSettingsMapper', () => {
  it('returns a masked webhook URL at the API boundary', () => {
    const mapper = new NotificationSettingsMapper();
    const setting = Object.assign(new ProjectNotificationSettings(), {
      id: 'setting-1',
      notificationType: NotificationType.SUCCESSFUL_RUNS_ALL_DM,
      enabled: true,
      receivers: [],
      webhookUrl:
        'https://chat.googleapis.com/v1/spaces/AAA/messages?key=google-api-key&token=google-webhook-token',
      groupingDelayCron: '0 * * * *',
      lastRunAt: null,
      nextRunAt: null,
      createdAt: new Date('2026-10-07T00:00:00.000Z'),
      modifiedAt: new Date('2026-10-07T00:00:00.000Z'),
    });

    const response = mapper.toResponseItem(setting, new Map());

    expect(response.webhookUrl).toBe(
      'https://chat.googleapis.com/v1/spaces/_redacted_/messages?key=REDACTED&token=REDACTED'
    );
    expect(JSON.stringify(response)).not.toContain('google-api-key');
    expect(JSON.stringify(response)).not.toContain('google-webhook-token');
  });
});
