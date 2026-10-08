import { expect } from 'chai';

import type { BaseCommand } from '../../src/commands/base.js';

import { IdpFactory } from '../../src/idp/factory.js';

describe('production identity provider selection', () => {
  let originalEnvironment: NodeJS.ProcessEnv;
  const command = {
    error(input: Error | string): never {
      throw typeof input === 'string' ? new Error(input) : input;
    },
  } as BaseCommand;

  beforeEach(() => {
    originalEnvironment = { ...process.env };
    process.env.NODE_ENV = 'production';
  });

  afterEach(() => {
    process.env = originalEnvironment;
  });

  for (const value of [undefined, '', '   ']) {
    it(`fails closed when the provider is ${JSON.stringify(value)}`, async () => {
      if (value === undefined) delete process.env.IDP_PROVIDER;
      else process.env.IDP_PROVIDER = value;
      let failure: unknown;
      try {
        await IdpFactory.createFromEnvironment(command);
      } catch (error) {
        failure = error;
      }

      expect(failure).to.be.instanceOf(Error);
      expect((failure as Error).message).to.equal(
        'IDP_PROVIDER must be explicitly set in production.'
      );
    });
  }

  it('retains explicitly configured single-user deployments', async () => {
    process.env.IDP_PROVIDER = 'none';
    const provider = await IdpFactory.createFromEnvironment(command);
    expect(await provider.introspectToken('')).to.have.property('userId', '0');
  });

  it('does not silently substitute the single-user provider for better-auth', async () => {
    process.env.IDP_PROVIDER = 'better-auth';
    delete process.env.IDP_BETTER_AUTH_SECRET;
    let failure: unknown;
    try {
      await IdpFactory.createFromEnvironment(command);
    } catch (error) {
      failure = error;
    }

    expect(failure).to.be.instanceOf(Error);
    expect((failure as Error).message).to.equal('IDP_BETTER_AUTH_SECRET is not set');
  });

  it('rejects an unknown configured provider', async () => {
    process.env.IDP_PROVIDER = 'unknown';
    let failure: unknown;
    try {
      await IdpFactory.createFromEnvironment(command);
    } catch (error) {
      failure = error;
    }

    expect(failure).to.be.instanceOf(Error);
    expect((failure as Error).message).to.equal('Unknown IDP provider: unknown');
  });
});
