import { ConfigService } from '@nestjs/config';
import { createDataSourceOptions } from './data-source-options.config';

describe('createDataSourceOptions', () => {
  it('falls back to SQLite when DB_TYPE is blank', () => {
    const options = createDataSourceOptions(
      new ConfigService({ DB_TYPE: '  ', SQLITE_DB_PATH: ':memory:' })
    );

    expect(options).toMatchObject({
      type: 'better-sqlite3',
      database: ':memory:',
    });
  });
});
