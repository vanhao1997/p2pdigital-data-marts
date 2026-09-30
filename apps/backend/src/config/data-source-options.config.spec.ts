import { ConfigService } from '@nestjs/config';
import type { LoggerService } from '@nestjs/common';
import { createDataSourceOptions, CustomDataSourceLogger } from './data-source-options.config';

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

  it('does not log SQL parameters by default', () => {
    const sink = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as unknown as LoggerService;
    const logger = new CustomDataSourceLogger(sink, 'all');

    logger.logQuery('SELECT * FROM credentials WHERE value = ?', ['secret-value']);
    logger.logQueryError('failed', 'UPDATE credentials SET value = ?', ['secret-value']);
    logger.logQuerySlow(100, 'SELECT * FROM credentials WHERE value = ?', ['secret-value']);

    expect(JSON.stringify(sink)).not.toContain('secret-value');
    expect(sink.log).toHaveBeenCalledWith('SELECT * FROM credentials WHERE value = ?');
    expect(sink.error).toHaveBeenCalledWith(
      '[QUERY ERROR] UPDATE credentials SET value = ?',
      'failed'
    );
    expect(sink.warn).toHaveBeenCalledWith(
      '[SLOW QUERY] (100ms): SELECT * FROM credentials WHERE value = ?'
    );
  });
});
