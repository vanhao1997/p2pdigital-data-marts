import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import { loadGasClass } from '../../support/loadGasClass.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

globalThis.DateUtils = { formatDate: date => date.toISOString().slice(0, 10) };
globalThis.RUN_CONFIG_TYPE = { INCREMENTAL: 'INCREMENTAL' };

loadGasClass(path.join(__dirname, '../../../src/Sources/FacebookMarketing/Connector.js'), {
  AbstractConnector: class {},
});

const connectorProto = globalThis.FacebookMarketingConnector.prototype;

// What Graph API returns for an ad account the token can no longer reach. AbstractSource marks
// OAuthException payloads as warnings, which is the signal this connector skips on.
const permissionError = (accountId = '') =>
  Object.assign(
    new Error(
      `(#200) Ad account owner has NOT grant ads_management or ads_read permission${accountId ? ` (act_${accountId})` : ''}`
    ),
    { isWarning: true }
  );

const globalAuthError = () =>
  Object.assign(
    new Error(
      'Error validating access token: Session has expired on Tuesday, 01-Jan-80 00:00:00 PST.'
    ),
    {
      isWarning: true,
      payload: {
        error: {
          code: 190,
          type: 'OAuthException',
        },
      },
    }
  );

const buildConnector = ({ fetchData, saveData = async () => undefined } = {}) => {
  const warnings = [];
  const logs = [];
  const cursorMovedTo = [];

  const self = Object.create(connectorProto);
  self.skippedAccounts = new Map();
  self.runConfig = { type: 'INCREMENTAL' };
  self.source = { fetchData };
  self.getStorageByNode = async () => ({ saveData });
  self.config = {
    logMessage: message => logs.push(message),
    logError: () => {},
    addWarningToCurrentStatus: message => warnings.push(message),
    CreateEmptyTables: { value: false },
    updateLastRequstedDate: date => cursorMovedTo.push(new Date(date).toISOString().slice(0, 10)),
  };

  return { self, warnings, logs, cursorMovedTo };
};

const timeSeriesNodes = { 'ad-account/insights': ['spend'] };
const importOneDay = (self, accountIds) =>
  connectorProto.startImportProcessOfTimeSeriesData.call(
    self,
    accountIds,
    timeSeriesNodes,
    new Date('2026-08-05T00:00:00Z'),
    1
  );

describe('time-series import: one inaccessible account', () => {
  it('imports the remaining accounts instead of losing the whole run', async () => {
    const saved = [];
    const { self, cursorMovedTo } = buildConnector({
      fetchData: async (_node, accountId) => {
        if (accountId === 'revoked') throw permissionError('revoked');
        return [{ account_id: accountId, spend: 1 }];
      },
      saveData: async rows => saved.push(...rows),
    });

    await importOneDay(self, ['revoked', 'working']);

    expect(saved).toEqual([{ account_id: 'working', spend: 1 }]);
    expect([...self.skippedAccounts.keys()]).toEqual(['revoked']);
    // the day completed for the accounts that could be imported, so the cursor moves on
    expect(cursorMovedTo).toEqual(['2026-08-05']);
  });

  it('reports the skip as a run warning, not only in the log', async () => {
    // Without this the run status stays plain SUCCESS and a permanently revoked account
    // becomes a silent gap: green runs, missing data, nothing to notice it by.
    const { self, warnings } = buildConnector({
      fetchData: async (_node, accountId) => {
        if (accountId === 'revoked') throw permissionError('revoked');
        return [];
      },
    });

    await importOneDay(self, ['revoked', 'working']);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('skipped one configured account');
    expect(warnings[0]).not.toContain('revoked');
    expect(warnings[0]).toContain('ads_read permission');
  });
});

describe('time-series import: failures that must not be skipped', () => {
  it('fails the run when a storage write fails, even though another account succeeded', async () => {
    // Skipping this would advance LastRequestedDate past a day whose data was never stored,
    // and once ReimportLookbackWindow passes that day is never requested again.
    const { self, cursorMovedTo } = buildConnector({
      fetchData: async () => [{ spend: 1 }],
      saveData: async () => {
        throw new Error('BigQuery write failed');
      },
    });

    await expect(importOneDay(self, ['first', 'second'])).rejects.toThrow('BigQuery write failed');
    expect(cursorMovedTo).toEqual([]);
    expect(self.skippedAccounts.size).toBe(0);
  });

  it('fails the run when a transient error survived its retries', async () => {
    const { self, cursorMovedTo } = buildConnector({
      fetchData: async () => {
        throw new Error('Facebook API is temporarily unavailable');
      },
    });

    await expect(importOneDay(self, ['first', 'second'])).rejects.toThrow(
      'temporarily unavailable'
    );
    expect(cursorMovedTo).toEqual([]);
  });
});

describe('time-series import: every account skipped', () => {
  it('throws before the cursor moves, so the day is requested again', async () => {
    // An expired token skips every account. Completing quietly here would report a successful
    // run that imported nothing and would move the cursor past data nobody ever fetched.
    const { self, cursorMovedTo } = buildConnector({
      fetchData: async (_node, accountId) => {
        throw permissionError(accountId);
      },
    });

    await expect(importOneDay(self, ['one', 'two'])).rejects.toThrow(
      /Facebook authorization failed: all 2 configured accounts were inaccessible for 2026-08-05/
    );
    expect(cursorMovedTo).toEqual([]);
  });

  it('names every account in the failure, not just the last one', async () => {
    const { self } = buildConnector({
      fetchData: async (_node, accountId) => {
        throw permissionError(accountId);
      },
    });

    const error = await importOneDay(self, ['one', 'two']).catch(e => e);

    expect(error.message).not.toContain('one');
    expect(error.message).not.toContain('two');
    expect(error.message).toContain('Reconnect Facebook');
    expect(error.message).toContain('ads_read and ads_management');
    expect(error.name).toBe('FacebookAuthorizationError');
    // A permission failure is customer-actionable: the readable message is kept, not a stack.
    expect(error.isWarning).toBe(true);
  });

  it('redacts provider secrets and identifiers from the customer-visible error', async () => {
    const leakedToken = 'EA' + 'A'.repeat(40);
    const { self } = buildConnector({
      fetchData: async () => {
        throw Object.assign(new Error(`(#200) access_token=${leakedToken} act_225706552450149`), {
          isWarning: true,
        });
      },
    });

    const error = await importOneDay(self, ['one']).catch(e => e);

    expect(error.message).not.toContain(leakedToken);
    expect(error.message).not.toContain('225706552450149');
    expect(error.message).toContain('access_token=[REDACTED]');
  });

  it('keeps the days already completed when the token expires mid-run', async () => {
    // The skip set resets per day, so days imported before the token expired stay done.
    let calls = 0;
    const { self, cursorMovedTo } = buildConnector({
      fetchData: async () => {
        calls += 1;
        if (calls > 1) throw permissionError();
        return [{ spend: 1 }];
      },
    });

    await expect(
      connectorProto.startImportProcessOfTimeSeriesData.call(
        self,
        ['only'],
        timeSeriesNodes,
        new Date('2026-08-05T00:00:00Z'),
        2
      )
    ).rejects.toThrow(
      /Facebook authorization failed: all 1 configured account was inaccessible for 2026-08-06/
    );

    expect(cursorMovedTo).toEqual(['2026-08-05']);
  });

  it('fails immediately when a global auth error appears after a partial success', async () => {
    const saved = [];
    const { self, cursorMovedTo } = buildConnector({
      fetchData: async (_node, accountId) => {
        if (accountId === 'working') return [{ account_id: accountId, spend: 1 }];
        throw globalAuthError();
      },
      saveData: async rows => saved.push(...rows),
    });

    const error = await importOneDay(self, ['working', 'broken']).catch(e => e);

    expect(error.name).toBe('FacebookAuthorizationError');
    expect(error.isWarning).toBe(true);
    expect(error.message).toContain('Reconnect Facebook');
    expect(saved).toEqual([{ account_id: 'working', spend: 1 }]);
    expect(cursorMovedTo).toEqual([]);
  });
});

describe('catalog import', () => {
  // Catalog nodes are imported before any time-series node, so an unreachable account here
  // aborted the whole run before a single day was requested.
  it('imports the remaining accounts instead of aborting the run', async () => {
    const fetched = [];
    const { self, warnings } = buildConnector({
      fetchData: async (_node, accountId, _fields, _date, onPage) => {
        if (accountId === 'revoked') throw permissionError('revoked');
        fetched.push(accountId);
        await onPage([{ account_id: accountId }]);
      },
    });

    await connectorProto.startImportProcessOfCatalogData.call(
      self,
      'ad-account',
      ['revoked', 'working'],
      ['id']
    );

    expect(fetched).toEqual(['working']);
    expect(warnings[0]).toContain('skipped one configured account');
    expect(warnings[0]).not.toContain('revoked');
  });

  it('fails when no account could be imported', async () => {
    const { self } = buildConnector({
      fetchData: async (_node, accountId) => {
        throw permissionError(accountId);
      },
    });

    await expect(
      connectorProto.startImportProcessOfCatalogData.call(
        self,
        'ad-account',
        ['one', 'two'],
        ['id']
      )
    ).rejects.toThrow(
      /Facebook authorization failed: all 2 configured accounts were inaccessible while importing ad-account/
    );
  });

  it('fails the run when a storage write fails', async () => {
    const { self } = buildConnector({
      fetchData: async (_node, _accountId, _fields, _date, onPage) => {
        await onPage([{ id: 1 }]);
      },
      saveData: async () => {
        throw new Error('BigQuery write failed');
      },
    });

    await expect(
      connectorProto.startImportProcessOfCatalogData.call(self, 'ad-account', ['one'], ['id'])
    ).rejects.toThrow('BigQuery write failed');
    expect(self.skippedAccounts.size).toBe(0);
  });
});

describe('_skipOrRethrow classification', () => {
  it('skips an account-scoped permission failure', () => {
    const { self, warnings } = buildConnector({ fetchData: async () => [] });

    connectorProto._skipOrRethrow.call(self, 'acc', permissionError('acc'), 'Importing 2026-08-05');

    expect([...self.skippedAccounts.keys()]).toEqual(['acc']);
    expect(warnings[0]).toContain('Importing 2026-08-05: skipped one configured account');
    expect(warnings[0]).not.toContain('act_acc');
  });

  it('rethrows anything that is not an account-scoped permission failure', () => {
    const { self } = buildConnector({ fetchData: async () => [] });

    expect(() =>
      connectorProto._skipOrRethrow.call(self, 'acc', new Error('BigQuery write failed'), 'ctx')
    ).toThrow('BigQuery write failed');
    expect(self.skippedAccounts.size).toBe(0);
  });

  it('redacts account identifiers before rethrowing provider failures', () => {
    const { self } = buildConnector({ fetchData: async () => [] });
    const error = new Error('Provider failed for act_123456789');

    expect(() => connectorProto._skipOrRethrow.call(self, 'acc', error, 'ctx')).toThrow(
      'Provider failed for the configured account'
    );
    expect(error.message).not.toContain('123456789');
  });
});
