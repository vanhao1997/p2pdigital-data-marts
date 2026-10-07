import { validate } from 'class-validator';
import { UpdateNotificationSettingApiDto } from './update-notification-setting-request-api.dto';

describe('UpdateNotificationSettingApiDto', () => {
  it('accepts the masked webhook URL returned by the API', async () => {
    const dto = new UpdateNotificationSettingApiDto();
    dto.webhookUrl =
      'https://chat.googleapis.com/v1/spaces/_redacted_/messages?key=REDACTED&token=REDACTED';

    await expect(validate(dto)).resolves.toHaveLength(0);
  });
});
