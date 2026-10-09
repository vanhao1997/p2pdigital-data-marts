import { spawn } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import {
  cleanupApp,
  completeBetterAuthMagicLink,
  CookieJar,
  createProjectWithSession,
  readBrowserAccessToken,
  type StartedApp,
} from './utils/api-key-app-smoke';
import { assertCliManifestsPrepared, useCliManifests } from './utils/cli-manifest-setup';

type JsonRecord = Record<string, unknown>;

const version = '2026-07-28';
const canary = 'native-mcp-oauth-secret-never-expose';
const backendTestRoot = __dirname;
const backendRoot = resolve(backendTestRoot, '..');
const repoRoot = resolve(backendRoot, '..', '..');
const owoxRoot = resolve(repoRoot, 'apps/owox');
const appSecret = 'test-secret-for-native-mcp-e2e-32-characters';

jest.setTimeout(240_000);

describe('Native Better Auth MCP OAuth (e2e)', () => {
  useCliManifests();

  it('authorizes native sessions, exchanges PKCE tokens, and scopes MCP setup tools', async () => {
    const primaryAdminEmail = `native-mcp-${randomUUID()}@example.test`;
    let app: StartedApp | undefined;

    try {
      app = await startNativeBetterAuthMcpApp(primaryAdminEmail);
      const session = await completeBetterAuthMagicLink(app, primaryAdminEmail);
      const browserToken = await readBrowserAccessToken(app.origin, session);
      const browserContext = await fetchJson<JsonRecord>(`${app.origin}/api/auth/context`, {
        headers: { 'x-owox-authorization': `Bearer ${browserToken}` },
      });
      expect(browserContext.status).toBe(200);
      expect(browserContext.body.projectId).toBe('0');

      const readGrant = await authorize(session, app.origin, 'mcp:read');
      const readToken = await exchangeCode(app.origin, readGrant);
      const sensitiveValues = [
        browserToken,
        readGrant.code,
        readGrant.verifier,
        readToken.access_token,
        readToken.refresh_token,
      ];
      const readList = await rpc(app.origin, readToken.access_token, 'tools/list');
      const readTools = (readList.result as { tools: Array<{ name: string }> }).tools;
      expect(readTools).toHaveLength(30);
      expect(readTools.map(tool => tool.name)).toEqual(
        expect.arrayContaining(['get_project_context', 'create_data_storage'])
      );

      const context = success(
        await callTool(app.origin, readToken.access_token, 'get_project_context')
      );
      expect(context).toMatchObject({ current_project: { id: '0' } });
      denied(
        await callTool(app.origin, readToken.access_token, 'create_data_storage', {
          storage_type: 'GOOGLE_BIGQUERY',
          title: 'Read denied',
        })
      );

      const mismatchGrant = await authorize(session, app.origin, 'mcp:read mcp:write');
      const mismatch = await tokenRequest(app.origin, {
        grant_type: 'authorization_code',
        code: mismatchGrant.code,
        client_id: mismatchGrant.clientId,
        redirect_uri: mismatchGrant.redirectUri,
        resource: `${app.origin}/wrong-resource`,
        code_verifier: mismatchGrant.verifier,
      });
      expect(mismatch.status).toBe(400);

      const writeGrant = await authorize(session, app.origin, 'mcp:read mcp:write');
      const writeToken = await exchangeCode(app.origin, writeGrant);
      sensitiveValues.push(
        writeGrant.code,
        writeGrant.verifier,
        writeToken.access_token,
        writeToken.refresh_token
      );
      expect(writeToken.refresh_token).toEqual(expect.any(String));

      const replay = await tokenRequest(app.origin, {
        grant_type: 'authorization_code',
        code: writeGrant.code,
        client_id: writeGrant.clientId,
        redirect_uri: writeGrant.redirectUri,
        resource: writeGrant.resource,
        code_verifier: writeGrant.verifier,
      });
      expect(replay.status).not.toBe(200);

      const refreshed = await tokenRequest(app.origin, {
        grant_type: 'refresh_token',
        refresh_token: writeToken.refresh_token,
        client_id: writeGrant.clientId,
        resource: writeGrant.resource,
      });
      expect(refreshed.status).toBe(200);
      expect(refreshed.body.access_token).toEqual(expect.any(String));
      sensitiveValues.push(
        String(refreshed.body.access_token),
        String(refreshed.body.refresh_token)
      );

      const refreshReplay = await tokenRequest(app.origin, {
        grant_type: 'refresh_token',
        refresh_token: writeToken.refresh_token,
        client_id: writeGrant.clientId,
        resource: writeGrant.resource,
      });
      expect(refreshReplay.status).not.toBe(200);

      const writeAccessToken = String(refreshed.body.access_token);
      const writeList = await rpc(app.origin, writeAccessToken, 'tools/list');
      expect((writeList.result as { tools: unknown[] }).tools).toHaveLength(30);
      const storage = success(
        await callTool(app.origin, writeAccessToken, 'create_data_storage', {
          storage_type: 'GOOGLE_BIGQUERY',
          title: 'Native MCP OAuth Warehouse',
        })
      );
      expect(storage.storage_id).toEqual(expect.any(String));

      const dataMart = success(
        await callTool(app.origin, writeAccessToken, 'create_data_mart', {
          title: 'Native MCP OAuth Draft',
          storage_id: storage.storage_id,
          definition_type: 'SQL',
          definition: { sqlQuery: 'SELECT 1 AS fixture' },
          description: 'Native Better Auth MCP OAuth fixture draft',
        })
      );
      expect(dataMart).toMatchObject({
        status: 'DRAFT',
        definition_type: 'SQL',
        storage_id: storage.storage_id,
      });

      const validation = await callTool(app.origin, writeAccessToken, 'validate_data_mart', {
        data_mart_id: dataMart.data_mart_id,
      });
      expect(JSON.stringify(validation)).not.toContain(canary);
      expect(validation.error || validation.result).toBeTruthy();

      const secondProject = await createProjectWithSession(
        app.origin,
        session,
        `Native MCP Cross ${randomUUID()}`
      );
      const projectGrant = await authorize(
        session,
        app.origin,
        'mcp:read mcp:write',
        secondProject.id
      );
      const projectToken = await exchangeCode(app.origin, projectGrant);
      sensitiveValues.push(
        projectGrant.code,
        projectGrant.verifier,
        projectToken.access_token,
        projectToken.refresh_token
      );
      denied(
        await callTool(app.origin, projectToken.access_token, 'get_data_mart_setup_status', {
          data_mart_id: dataMart.data_mart_id,
        })
      );

      expect(app.logs()).not.toContain(canary);
      for (const value of sensitiveValues) {
        expect(app.logs()).not.toContain(value);
        expect(JSON.stringify(validation)).not.toContain(value);
      }
    } finally {
      if (app) await cleanupApp(app);
    }
  });
});

async function startNativeBetterAuthMcpApp(primaryAdminEmail: string): Promise<StartedApp> {
  assertCliManifestsPrepared();

  const port = await availablePort();
  const origin = `http://127.0.0.1:${port}`;
  const tempDir = mkdtempSync(join(tmpdir(), 'owox-native-mcp-better-auth-'));
  const testMagicLinkFile = join(tempDir, 'magic-link.txt');
  let logBuffer = '';
  let exited: { code: number | null; signal: NodeJS.Signals | null } | null = null;

  const child = spawn(process.execPath, ['./bin/run.js', 'serve', '--no-web-enabled'], {
    cwd: owoxRoot,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      OWOX_TELEMETRY_DISABLED: '1',
      SCHEDULER_EXECUTION_ENABLED: 'false',
      ADMICRO_EXTRACTOR_ENABLED: 'false',
      AWS_EC2_METADATA_DISABLED: 'true',
      SNOWFLAKE_DISABLE_PLATFORM_DETECTION: 'true',
      DB_TYPE: 'sqlite',
      SQLITE_DB_PATH: join(tempDir, 'app.sqlite'),
      IDP_PROVIDER: 'better-auth',
      PORT: String(port),
      PUBLIC_ORIGIN: origin,
      LOG_FORMAT: 'json',
      MCP_PUBLIC_BASE_URL: origin,
      OWOX_AUTH_PUBLIC_BASE_URL: origin,
      MCP_DYNAMIC_CLIENT_REGISTRATION_ENABLED: 'true',
      IDP_BETTER_AUTH_SECRET: appSecret,
      IDP_BETTER_AUTH_DATABASE_TYPE: 'sqlite',
      IDP_BETTER_AUTH_SQLITE_DB_PATH: join(tempDir, 'auth.sqlite'),
      IDP_BETTER_AUTH_BASE_URL: origin,
      IDP_BETTER_AUTH_TRUSTED_ORIGINS: origin,
      IDP_BETTER_AUTH_PRIMARY_ADMIN_EMAIL: primaryAdminEmail,
      IDP_BETTER_AUTH_TEST_MAGIC_LINK_FILE: testMagicLinkFile,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const appendLogs = (chunk: Buffer) => {
    logBuffer += chunk.toString('utf8');
    if (logBuffer.length > 256_000) logBuffer = logBuffer.slice(-256_000);
  };
  child.stdout.on('data', appendLogs);
  child.stderr.on('data', appendLogs);
  child.once('exit', (code, signal) => {
    exited = { code, signal };
  });

  const logs = () => logBuffer;
  const stop = async () => {
    if (exited) return;
    const exitPromise = new Promise<void>(resolveExit => child.once('exit', () => resolveExit()));
    child.kill('SIGTERM');
    const forceStop = setTimeout(() => {
      if (!exited) child.kill('SIGKILL');
    }, 10_000);
    try {
      await exitPromise;
    } finally {
      clearTimeout(forceStop);
    }
  };

  try {
    await waitUntil('native MCP app readiness', async () => {
      if (exited) throw new Error(`owox serve exited before readiness\n${logs()}`);
      try {
        return (await fetch(`${origin}/health/ready`)).status === 200;
      } catch {
        return false;
      }
    });
  } catch (error) {
    await stop();
    rmSync(tempDir, { force: true, recursive: true });
    throw new Error(`Native MCP app failed before OAuth acceptance\n${logs()}`, { cause: error });
  }

  return {
    origin,
    tempDir,
    testMagicLinkFile,
    logs,
    stop,
    waitForLog: pattern =>
      waitUntil(`log pattern ${pattern}`, () => {
        if (exited) throw new Error(`owox serve exited before ${pattern}\n${logs()}`);
        return logs().match(pattern) ?? false;
      }),
  };
}

async function authorize(
  session: CookieJar,
  origin: string,
  scope: string,
  selectedProjectId?: string
): Promise<{
  clientId: string;
  code: string;
  redirectUri: string;
  resource: string;
  verifier: string;
}> {
  const redirectUri = `http://127.0.0.1:${await availablePort()}/callback`;
  const registration = await fetchJson<JsonRecord>(`${origin}/oauth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      redirect_uris: [redirectUri],
      client_name: `native-mcp-${scope.replaceAll(':', '-')}`,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      scope,
    }),
  });
  expect([200, 201]).toContain(registration.status);
  const clientId = String(registration.body.client_id);
  const { verifier, challenge } = pkcePair();
  const state = `state-${randomUUID()}`;
  const resource = `${origin}/mcp`;
  const url = new URL(`${origin}/oauth/authorize`);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', scope);
  url.searchParams.set('state', state);
  url.searchParams.set('resource', resource);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  if (selectedProjectId) url.searchParams.set('selected_project_id', selectedProjectId);

  const response = await session.fetch(url.toString(), { redirect: 'manual' });
  expect([301, 302, 303, 307, 308]).toContain(response.status);
  const location = response.headers.get('location');
  expect(location).toEqual(expect.any(String));
  const callback = new URL(location!);
  expect(callback.origin).toBe(new URL(redirectUri).origin);
  expect(callback.searchParams.get('state')).toBe(state);
  const code = callback.searchParams.get('code');
  expect(code).toEqual(expect.any(String));
  expect(callback.searchParams.get('iss')).toBe(origin);

  return { clientId, code: code!, redirectUri, resource, verifier };
}

async function exchangeCode(
  origin: string,
  grant: {
    clientId: string;
    code: string;
    redirectUri: string;
    resource: string;
    verifier: string;
  }
): Promise<{
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}> {
  const response = await tokenRequest(origin, {
    grant_type: 'authorization_code',
    code: grant.code,
    client_id: grant.clientId,
    redirect_uri: grant.redirectUri,
    resource: grant.resource,
    code_verifier: grant.verifier,
  });
  expect(response.status).toBe(200);
  expect(response.body.token_type).toMatch(/^Bearer$/i);
  expect(response.body.access_token).toEqual(expect.any(String));
  return response.body as {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
  };
}

async function tokenRequest(origin: string, body: JsonRecord) {
  return fetchJson<JsonRecord>(`${origin}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function rpc(
  origin: string,
  token: string,
  method: string,
  params: JsonRecord = {}
): Promise<JsonRecord> {
  const response = await fetch(`${origin}/mcp`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
      'MCP-Protocol-Version': version,
      'Mcp-Method': method,
      ...(typeof params.name === 'string' ? { 'Mcp-Name': params.name } : {}),
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params: {
        ...params,
        _meta: {
          'io.modelcontextprotocol/protocolVersion': version,
          'io.modelcontextprotocol/clientCapabilities': {},
          'io.modelcontextprotocol/clientInfo': { name: 'native-e2e', version: '1.0' },
        },
      },
    }),
  });
  const text = await response.text();
  expect(text).not.toContain(canary);
  expect(response.status).toBe(200);
  if (response.headers.get('content-type')?.startsWith('text/event-stream')) {
    const data = text.split('\n').find(line => line.startsWith('data: '));
    expect(data).toBeTruthy();
    return JSON.parse(data!.slice(6)) as JsonRecord;
  }
  return JSON.parse(text) as JsonRecord;
}

function callTool(origin: string, token: string, name: string, args: JsonRecord = {}) {
  return rpc(origin, token, 'tools/call', { name, arguments: args });
}

function success(body: JsonRecord): JsonRecord {
  expect(body.error).toBeUndefined();
  const result = body.result as { isError?: boolean; structuredContent?: JsonRecord } | undefined;
  expect(result?.isError).not.toBe(true);
  expect(result?.structuredContent).toEqual(expect.any(Object));
  return result!.structuredContent!;
}

function denied(body: JsonRecord): void {
  const result = body.result as { isError?: boolean } | undefined;
  expect(Boolean(body.error) || result?.isError === true).toBe(true);
}

function pkcePair() {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

async function fetchJson<T>(
  url: string,
  init: RequestInit = {}
): Promise<{ status: number; body: T }> {
  const response = await fetch(url, init);
  const text = await response.text();
  expect(text).not.toContain(canary);
  const body = text ? (JSON.parse(text) as T) : (undefined as T);
  return { status: response.status, body };
}

async function availablePort(): Promise<number> {
  return new Promise((resolvePort, rejectPort) => {
    const server = createServer();
    server.once('error', rejectPort);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        rejectPort(new Error('Failed to allocate a local port'));
        return;
      }
      server.close(() => resolvePort(address.port));
    });
  });
}

async function waitUntil<T>(
  description: string,
  predicate: () => T | false | Promise<T | false>,
  timeoutMs = 90_000
): Promise<T> {
  const started = Date.now();
  let lastError: unknown;
  while (Date.now() - started < timeoutMs) {
    try {
      const result = await predicate();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await delay(250);
  }
  if (lastError instanceof Error) throw lastError;
  throw new Error(`Timed out waiting for ${description}`);
}

function delay(ms: number): Promise<void> {
  return new Promise(resolveDelay => setTimeout(resolveDelay, ms));
}
