import { afterEach, describe, expect, it } from '@jest/globals';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BetterAuthProvider } from './better-auth-provider.js';
import type { createBetterAuthConfig } from '../auth/auth-config.js';
import type { DatabaseStore } from '../store/DatabaseStore.js';

describe('BetterAuthProvider native MCP grants', () => {
  let providers: BetterAuthProvider[] = [];
  let directory: string;
  afterEach(async () => {
    await Promise.all(providers.map(provider => provider.shutdown()));
    providers = [];
    if (directory) rmSync(directory, { recursive: true, force: true });
  });
  it('persists grants through restart and enforces live project membership, archive and role changes', async () => {
    directory = mkdtempSync(join(tmpdir(), 'owox-native-grants-'));
    const config = {
      database: { type: 'sqlite' as const, filename: join(directory, 'auth.db') },
      baseURL: 'http://localhost:3000',
      secret: 'persistent-native-mcp-secret-32-characters',
      magicLinkTtl: 3600,
    };
    const provider = await BetterAuthProvider.create(config);
    providers.push(provider);
    await provider.initialize();
    const native = provider as unknown as {
      auth: Awaited<ReturnType<typeof createBetterAuthConfig>>;
      store: DatabaseStore;
    };
    const signup = await native.auth.api.signUpEmail({
      body: { email: 'native@example.test', password: 'TestPassword123', name: 'Native' },
    });
    const project = await provider.createProject(signup.user.id, 'MCP native test');
    const verifier = randomBytes(32).toString('base64url');
    const resource = 'https://digitalreport.p2pdigital.io.vn/mcp';
    const code = await provider.createMcpOAuthAuthorizationCode(
      {
        clientId: 'native-client',
        redirectUri: 'http://127.0.0.1:4000/callback',
        resource,
        scopes: ['mcp:read', 'mcp:write'],
        state: 'state',
        codeChallengeMethod: 'S256',
        codeChallenge: createHash('sha256').update(verifier).digest('base64url'),
      },
      { userId: signup.user.id, projectId: project.id, roles: ['admin'] }
    );
    const tokens = await provider.exchangeMcpOAuthToken({
      grantType: 'authorization_code',
      code: code.code,
      clientId: code.clientId,
      redirectUri: code.redirectUri,
      resource,
      codeVerifier: verifier,
    });
    expect(await provider.parseToken(tokens.access_token)).toBeNull();
    await provider.shutdown();
    const restarted = await BetterAuthProvider.create(config);
    providers = [restarted];
    await restarted.initialize();
    expect(
      await restarted.verifyMcpAccessToken(tokens.access_token, resource, ['mcp:read'])
    ).toMatchObject({ projectId: project.id, roles: ['admin'] });
    const store = (restarted as unknown as { store: DatabaseStore }).store;
    await store.addUserToOrganization(project.id, signup.user.id, 'viewer');
    expect(
      await restarted.verifyMcpAccessToken(tokens.access_token, resource, ['mcp:read'])
    ).toMatchObject({ roles: ['viewer'] });
    await store.updateOrganization(project.id, project.title, JSON.stringify({ archived: true }));
    expect(
      await restarted.verifyMcpAccessToken(tokens.access_token, resource, ['mcp:read'])
    ).toBeNull();
    await store.updateOrganization(project.id, project.title, JSON.stringify({ archived: false }));
    await store.removeUserFromOrganization(project.id, signup.user.id);
    expect(
      await restarted.verifyMcpAccessToken(tokens.access_token, resource, ['mcp:read'])
    ).toBeNull();
    await expect(
      restarted.exchangeMcpOAuthToken({
        grantType: 'refresh_token',
        refreshToken: tokens.refresh_token!,
        clientId: code.clientId,
        resource,
      })
    ).rejects.toThrow('Invalid or expired MCP OAuth grant');
  });
});
