jest.mock('@databricks/sql', () => ({ DBSQLClient: jest.fn() }));

import { Logger } from '@nestjs/common';
import { DBSQLClient } from '@databricks/sql';
import { LogLevel } from '@databricks/sql/dist/contracts/IDBSQLLogger';
import { DatabricksAuthMethod } from '../enums/databricks-auth-method.enum';
import { DatabricksApiAdapter } from './databricks-api.adapter';

describe('Databricks adapter credential log redaction', () => {
  const secret = 'DATABRICKS_PRIVATE_TOKEN';
  afterEach(() => jest.restoreAllMocks());

  const setup = () => {
    const close = jest.fn().mockResolvedValue(undefined);
    (DBSQLClient as jest.Mock).mockImplementation(() => ({ close }));
    const adapter = new DatabricksApiAdapter(
      { authMethod: DatabricksAuthMethod.PERSONAL_ACCESS_TOKEN, token: secret },
      { host: 'workspace.cloud.databricks.com', httpPath: '/sql/warehouse' }
    );
    return { adapter, close };
  };

  it('logs driver severity without SDK messages that can contain connection secrets', () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    (DBSQLClient as jest.Mock).mockClear();
    setup();
    const logger = (DBSQLClient as jest.Mock).mock.calls[0][0].logger;
    logger.log(LogLevel.error, `connect token=${secret}`);
    logger.log(LogLevel.warn, `retry token=${secret}`);
    expect(error).toHaveBeenCalledWith('Databricks driver error');
    expect(warn).toHaveBeenCalledWith('Databricks driver warning');
    expect(JSON.stringify([error.mock.calls, warn.mock.calls])).not.toContain(secret);
  });

  it('redacts connection teardown errors', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { adapter, close } = setup();
    close.mockRejectedValue(new Error(`token=${secret}`));
    await adapter.destroy();
    expect(error).toHaveBeenCalledWith('Failed to destroy Databricks connection');
    expect(JSON.stringify(error.mock.calls)).not.toContain(secret);
  });
});
