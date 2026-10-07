import { assertStandaloneRuntime } from './standalone-runtime.config';

describe('standalone runtime boundary', () => {
  it.each([undefined, 'production', 'staging', ''])('rejects NODE_ENV=%s', NODE_ENV => {
    expect(() => assertStandaloneRuntime({ NODE_ENV })).toThrow('Use owox serve.');
  });

  it.each(['development', 'test'])('allows the deliberate %s fixture', NODE_ENV => {
    expect(() => assertStandaloneRuntime({ NODE_ENV, IDP_PROVIDER: 'none' })).not.toThrow();
  });

  it.each(['better-auth', 'owox-better-auth', 'unknown'])(
    'rejects an ignored provider %s',
    IDP_PROVIDER => {
      expect(() => assertStandaloneRuntime({ NODE_ENV: 'test', IDP_PROVIDER })).toThrow(
        'Standalone backend cannot use the configured IDP_PROVIDER'
      );
    }
  );
});
