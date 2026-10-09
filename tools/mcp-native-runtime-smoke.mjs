import { spawn } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const runtimeRoot = process.env.MCP_SMOKE_RUNTIME_ROOT || '/usr/local/lib/node_modules/owox';
const revision = process.env.MCP_SMOKE_EXPECTED_REVISION || 'unknown';
const tempDir = mkdtempSync(join(tmpdir(), 'mcp-release-fixture-'));
const email = `mcp-release-${randomUUID()}@example.test`;
const magicLinkFile = join(tempDir, 'magic-link.txt');
const canary = 'mcp-fixture-plaintext-secret-never-expose';
const receipt = {
  revision,
  scope: 'native-better-auth-dcr-pkce-mcp-setup',
  mockedOAuthProvider: false,
  freshDatabases: true,
  liveProductionMounted: false,
  publicPorts: 0,
  externalProviderSyncTested: false,
  billingExecutionTested: false,
  providerCredentialsUsed: false,
  passed: false,
  checks: {},
  limitations: [
    'Provider access validation runs offline; unconfigured provider checks must fail safely.',
    'Native Better Auth uses the real SQLite verification store; no OAuth hooks are replaced.',
    'No live sync, run history, billing charge, or external connector quota is asserted.',
  ],
  assertionCount: 0,
};
let child;
let childExited = false;
let logBuffer = '';
let stage = 'start';
const secrets = new Set([canary]);

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function check(condition, code) {
  receipt.assertionCount += 1;
  if (!condition) {
    const error = new Error(code);
    error.safeCode = code;
    throw error;
  }
}

async function waitFor(predicate, code, timeout = 90_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    check(!childExited, 'fixture-process-exited');
    try {
      const value = await predicate();
      if (value) return value;
    } catch (error) {
      if (error.safeCode) throw error;
    }
    await delay(250);
  }
  check(false, code);
}

async function availablePort() {
  const server = createServer();
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : undefined;
      server.close(() => (port ? resolve(port) : reject(new Error('port-unavailable'))));
    });
  });
}

class CookieJar {
  cookies = new Map();

  header() {
    return [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
  }

  headers(init = {}) {
    const headers = new Headers(init);
    if (this.cookies.size) headers.set('cookie', this.header());
    return headers;
  }

  async fetch(url, init = {}) {
    const response = await fetch(url, {
      ...init,
      headers: this.headers(init.headers),
      signal: AbortSignal.timeout(10_000),
    });
    this.store(response);
    return response;
  }

  store(response) {
    const cookies =
      response.headers.getSetCookie?.() ?? [response.headers.get('set-cookie')].filter(Boolean);
    for (const cookie of cookies) {
      const [pair, ...attributes] = cookie.split(';');
      const index = pair.indexOf('=');
      if (index < 0) continue;
      const name = pair.slice(0, index).trim();
      const value = pair.slice(index + 1).trim();
      if (attributes.join(';').toLowerCase().includes('max-age=0')) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }
}

async function jsonRequest(url, init = {}, jar) {
  const response = jar
    ? await jar.fetch(url, init)
    : await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    check(false, `${stage}-invalid-json`);
  }
  check(!text.includes(canary), `${stage}-response-secret-redacted`);
  return { status: response.status, body, text, headers: response.headers, url: response.url };
}

function bearer(token) {
  return { Authorization: `Bearer ${token}` };
}

function xOwox(token) {
  return { 'x-owox-authorization': `Bearer ${token}` };
}

function rpcHeaders(token, extra = {}) {
  return {
    ...bearer(token),
    Accept: 'application/json, text/event-stream',
    'Content-Type': 'application/json',
    'MCP-Protocol-Version': '2026-07-28',
    ...extra,
  };
}

async function rpc(origin, token, method, params = {}) {
  const response = await fetch(`${origin}/mcp`, {
    method: 'POST',
    headers: rpcHeaders(token, {
      'Mcp-Method': method,
      ...(typeof params.name === 'string' ? { 'Mcp-Name': params.name } : {}),
    }),
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params: {
        ...params,
        _meta: {
          'io.modelcontextprotocol/protocolVersion': '2026-07-28',
          'io.modelcontextprotocol/clientCapabilities': {},
          'io.modelcontextprotocol/clientInfo': { name: 'release-fixture', version: '1.0' },
        },
      },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await response.text();
  check(
    [...secrets].every(secret => !text.includes(secret)),
    `${stage}-mcp-secret-redacted`
  );
  if (response.status !== 200) {
    try {
      const body = text ? JSON.parse(text) : {};
      receipt.lastMcpError = {
        status: response.status,
        message: body?.error?.message ?? body?.message ?? 'unknown',
      };
    } catch {
      receipt.lastMcpError = { status: response.status, message: 'non-json' };
    }
  }
  check(response.status === 200, `${stage}-mcp-http-${response.status}`);
  if (response.headers.get('content-type')?.startsWith('text/event-stream')) {
    const dataLine = text.split('\n').find(line => line.startsWith('data: '));
    check(Boolean(dataLine), `${stage}-mcp-sse-data`);
    return JSON.parse(dataLine.slice(6));
  }
  return JSON.parse(text);
}

async function callTool(origin, token, name, args = {}) {
  return rpc(origin, token, 'tools/call', { name, arguments: args });
}

function structured(body) {
  check(!body.error, `${stage}-jsonrpc-error`);
  check(body.result?.isError !== true, `${stage}-tool-error`);
  return body.result.structuredContent;
}

function expectDenied(body, code) {
  check(Boolean(body.error) || body.result?.isError === true, code);
}

function pkcePair() {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

async function completeMagicLink(origin) {
  const magicLink = await waitFor(() => {
    if (!existsSync(magicLinkFile)) return false;
    return readFileSync(magicLinkFile, 'utf8').trim() || false;
  }, 'magic-link-timeout');
  check(new URL(magicLink).origin === origin, 'magic-link-loopback-only');
  const preconfirm = await fetch(magicLink, { signal: AbortSignal.timeout(10_000) });
  check(preconfirm.status === 200, 'magic-link-preconfirm-status');
  const match = (await preconfirm.text()).match(/id="continue-link"[^>]+href="([^"]+)"/);
  check(Boolean(match), 'magic-link-continue-present');
  const session = new CookieJar();
  let nextUrl = new URL(match[1].replaceAll('&amp;', '&'), origin).toString();
  let confirmed;
  for (let index = 0; index < 10; index += 1) {
    check(new URL(nextUrl).origin === origin, 'auth-redirect-loopback-only');
    confirmed = await session.fetch(nextUrl, { redirect: 'manual' });
    if (![301, 302, 303, 307, 308].includes(confirmed.status)) break;
    const location = confirmed.headers.get('location');
    check(Boolean(location), 'auth-redirect-location-present');
    nextUrl = new URL(location, nextUrl).toString();
  }
  check(confirmed?.status === 200, 'magic-link-confirm-status');
  receipt.checks.magicLinkSignIn = true;
  return session;
}

async function oauthToken(origin, session, scope, selectedProjectId) {
  const redirectUri = `http://127.0.0.1:${await availablePort()}/callback`;
  const registration = await jsonRequest(`${origin}/oauth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      redirect_uris: [redirectUri],
      client_name: `fixture-${scope.replaceAll(':', '-')}`,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      scope,
    }),
  });
  check(registration.status === 201 || registration.status === 200, `${stage}-dcr-status`);
  const clientId = registration.body.client_id;
  check(typeof clientId === 'string' && clientId.startsWith('mcp_dyn_'), `${stage}-dcr-client`);
  const { verifier, challenge } = pkcePair();
  const state = `state-${randomUUID()}`;
  const authorizeUrl = new URL(`${origin}/oauth/authorize`);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('scope', scope);
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('code_challenge', challenge);
  authorizeUrl.searchParams.set('code_challenge_method', 'S256');
  authorizeUrl.searchParams.set('resource', `${origin}/mcp`);
  if (selectedProjectId) authorizeUrl.searchParams.set('selected_project_id', selectedProjectId);
  const authorized = await session.fetch(authorizeUrl.toString(), { redirect: 'manual' });
  check([301, 302, 303, 307, 308].includes(authorized.status), `${stage}-authorize-redirect`);
  const location = authorized.headers.get('location');
  check(Boolean(location), `${stage}-authorize-location`);
  const callback = new URL(location);
  check(callback.origin === new URL(redirectUri).origin, `${stage}-authorize-redirect-origin`);
  check(callback.searchParams.get('state') === state, `${stage}-authorize-state`);
  const code = callback.searchParams.get('code');
  check(Boolean(code), `${stage}-authorize-code`);
  check(callback.searchParams.get('iss') === origin, `${stage}-authorize-issuer`);
  secrets.add(code);
  secrets.add(verifier);
  const exchangeBody = {
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    redirect_uri: redirectUri,
    resource: `${origin}/mcp`,
    code_verifier: verifier,
  };
  const requestToken = body =>
    jsonRequest(`${origin}/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  const token = await requestToken(exchangeBody);
  check(token.status === 200, `${stage}-token-status`);
  check(token.body.token_type === 'Bearer', `${stage}-token-type`);
  check(token.body.access_token.startsWith('mcp_access_'), `${stage}-native-access-token`);
  check(token.body.refresh_token.startsWith('mcp_refresh_'), `${stage}-native-refresh-token`);
  secrets.add(token.body.access_token);
  secrets.add(token.body.refresh_token);
  const replay = await requestToken(exchangeBody);
  check(replay.status === 400 && replay.body.error === 'invalid_grant', `${stage}-code-single-use`);
  const refreshBody = {
    grant_type: 'refresh_token',
    refresh_token: token.body.refresh_token,
    client_id: clientId,
    resource: `${origin}/mcp`,
  };
  const rotated = await requestToken(refreshBody);
  check(rotated.status === 200, `${stage}-refresh-status`);
  check(rotated.body.refresh_token !== token.body.refresh_token, `${stage}-refresh-rotated`);
  secrets.add(rotated.body.access_token);
  secrets.add(rotated.body.refresh_token);
  const refreshReplay = await requestToken(refreshBody);
  check(
    refreshReplay.status === 400 && refreshReplay.body.error === 'invalid_grant',
    `${stage}-refresh-single-use`
  );
  check(
    [replay.text, refreshReplay.text].every(text =>
      [...secrets].every(secret => !text.includes(secret))
    ),
    `${stage}-oauth-error-redacted`
  );
  return rotated.body.access_token;
}

async function main() {
  check(existsSync(join(runtimeRoot, 'apps/owox/bin/run.js')), 'installed-runtime-present');
  const origin = `http://127.0.0.1:${await availablePort()}`;
  child = spawn(process.execPath, ['./bin/run.js', 'serve', '--no-web-enabled'], {
    cwd: join(runtimeRoot, 'apps/owox'),
    env: {
      PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
      NODE_ENV: 'test',
      OWOX_TELEMETRY_DISABLED: '1',
      SCHEDULER_EXECUTION_ENABLED: 'false',
      ADMICRO_EXTRACTOR_ENABLED: 'false',
      AWS_EC2_METADATA_DISABLED: 'true',
      SNOWFLAKE_DISABLE_PLATFORM_DETECTION: 'true',
      DB_TYPE: 'sqlite',
      SQLITE_DB_PATH: join(tempDir, 'app.sqlite'),
      IDP_PROVIDER: 'better-auth',
      PORT: new URL(origin).port,
      PUBLIC_ORIGIN: origin,
      LOG_FORMAT: 'json',
      MCP_PUBLIC_BASE_URL: origin,
      OWOX_AUTH_PUBLIC_BASE_URL: origin,
      MCP_DYNAMIC_CLIENT_REGISTRATION_ENABLED: 'true',
      IDP_BETTER_AUTH_SECRET: randomBytes(48).toString('base64url'),
      IDP_BETTER_AUTH_DATABASE_TYPE: 'sqlite',
      IDP_BETTER_AUTH_SQLITE_DB_PATH: join(tempDir, 'auth.sqlite'),
      IDP_BETTER_AUTH_BASE_URL: origin,
      IDP_BETTER_AUTH_TRUSTED_ORIGINS: origin,
      IDP_BETTER_AUTH_PRIMARY_ADMIN_EMAIL: email,
      IDP_BETTER_AUTH_TEST_MAGIC_LINK_FILE: magicLinkFile,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', chunk => {
    logBuffer += chunk.toString('utf8');
    if (logBuffer.length > 256_000) logBuffer = logBuffer.slice(-256_000);
  });
  child.stderr.on('data', chunk => {
    logBuffer += chunk.toString('utf8');
    if (logBuffer.length > 256_000) logBuffer = logBuffer.slice(-256_000);
  });
  child.once('exit', () => {
    childExited = true;
  });
  child.once('error', () => {
    childExited = true;
  });

  await waitFor(async () => {
    try {
      return (
        (await fetch(`${origin}/health/ready`, { signal: AbortSignal.timeout(2_000) })).status ===
        200
      );
    } catch {
      return false;
    }
  }, 'fixture-readiness-timeout');
  receipt.checks.readiness = true;

  stage = 'login';
  const session = await completeMagicLink(origin);
  const browserToken = await jsonRequest(`${origin}/auth/access-token`, {}, session);
  check(browserToken.status === 200, 'browser-token-status');
  secrets.add(browserToken.body.accessToken);
  const context = await jsonRequest(`${origin}/api/auth/context`, {
    headers: xOwox(browserToken.body.accessToken),
  });
  check(context.status === 200 && context.body.projectId === '0', 'default-project-context');

  stage = 'oauth-read';
  const readToken = await oauthToken(origin, session, 'mcp:read');
  const unauthenticated = await fetch(`${origin}/mcp`, { method: 'POST', body: '{}' });
  check(unauthenticated.status === 401, 'mcp-unauthenticated-denied');
  const readList = await rpc(origin, readToken, 'tools/list');
  check(readList.result.tools.length === 30, 'read-token-tools-list-30');
  const projectContext = structured(await callTool(origin, readToken, 'get_project_context'));
  check(projectContext.current_project.id === '0', 'mcp-authenticated-project-context');
  expectDenied(
    await callTool(origin, readToken, 'create_data_storage', {
      storage_type: 'GOOGLE_BIGQUERY',
      title: 'Read denied',
    }),
    'read-token-mutation-denied'
  );

  stage = 'oauth-write';
  const writeTokenA = await oauthToken(origin, session, 'mcp:read mcp:write');
  const writeList = await rpc(origin, writeTokenA, 'tools/list');
  check(writeList.result.tools.length === 30, 'write-token-tools-list-30');
  const storage = structured(
    await callTool(origin, writeTokenA, 'create_data_storage', {
      storage_type: 'GOOGLE_BIGQUERY',
      title: 'Fixture Warehouse A',
    })
  );
  const storageId = storage.storage_id;
  check(typeof storageId === 'string', 'storage-created');
  expectDenied(
    await callTool(origin, writeTokenA, 'configure_data_storage', {
      storage_id: storageId,
      title: 'Secret attempt',
      config: { projectId: 'fixture', private_key: canary },
    }),
    'plaintext-secret-rejected'
  );
  const validation = structured(
    await callTool(origin, writeTokenA, 'validate_data_storage', { storage_id: storageId })
  );
  check(validation.valid === false, 'offline-storage-validation-safe-failure');
  check(
    ['UNCONFIGURED', 'OAUTH_REAUTH_REQUIRED', undefined].includes(validation.code),
    'safe-validation-code'
  );

  const dataMart = structured(
    await callTool(origin, writeTokenA, 'create_data_mart', {
      title: 'Fixture Draft',
      storage_id: storageId,
      definition_type: 'SQL',
      definition: { sqlQuery: 'SELECT 1 AS fixture' },
      description: 'Offline MCP fixture draft',
    })
  );
  const dataMartId = dataMart.data_mart_id;
  check(dataMart.status === 'DRAFT' && typeof dataMartId === 'string', 'draft-created');
  const definitionValidation = structured(
    await callTool(origin, writeTokenA, 'validate_data_mart', { data_mart_id: dataMartId })
  );
  check(definitionValidation.valid === false, 'unconfigured-draft-validation-fails-safely');
  expectDenied(
    await callTool(origin, writeTokenA, 'publish_data_mart', { data_mart_id: dataMartId }),
    'unconfigured-draft-publish-denied'
  );
  const updated = structured(
    await callTool(origin, writeTokenA, 'update_data_mart', {
      data_mart_id: dataMartId,
      title: 'Fixture Draft Updated',
    })
  );
  check(updated.title === 'Fixture Draft Updated', 'draft-updated');
  const status = structured(
    await callTool(origin, writeTokenA, 'get_data_mart_setup_status', { data_mart_id: dataMartId })
  );
  check(status.data_mart_id === dataMartId && status.storage_id === storageId, 'draft-status');

  stage = 'cross-project';
  const project = await jsonRequest(`${origin}/auth/api/project-management/projects`, {
    method: 'POST',
    headers: session.headers({ 'content-type': 'application/json', origin }),
    body: JSON.stringify({ name: `Fixture B ${randomUUID()}` }),
  });
  check(project.status === 201 && typeof project.body.id === 'string', 'project-b-created');
  const writeTokenB = await oauthToken(origin, session, 'mcp:read mcp:write', project.body.id);
  expectDenied(
    await callTool(origin, writeTokenB, 'get_data_mart_setup_status', { data_mart_id: dataMartId }),
    'cross-project-data-mart-denied'
  );

  check(
    [...secrets].every(secret => !logBuffer.includes(secret)),
    'logs-no-codes-tokens-verifiers-or-secret'
  );
  receipt.checks.nativeOAuthReplayAndRefresh = true;
  receipt.checks.oauthDcrPkce = true;
  receipt.checks.mcpToolsList30 = true;
  receipt.checks.readOnlyMutationDenied = true;
  receipt.checks.storageDraftUpdateStatus = true;
  receipt.checks.plaintextSecretRejected = true;
  receipt.checks.crossProjectDenied = true;
  receipt.checks.noSecretInLogs = true;
  receipt.checks.nativeProviderWithoutMocks = true;
  receipt.checks.appDatabaseCreated = existsSync(join(tempDir, 'app.sqlite'));
  receipt.checks.authDatabaseCreated = existsSync(join(tempDir, 'auth.sqlite'));
  receipt.passed = true;
}

try {
  await main();
} catch (error) {
  receipt.failedCheck = error.safeCode || `${stage}-unexpected-error`;
  process.exitCode = 1;
} finally {
  if (child && !childExited) {
    child.kill('SIGTERM');
    await Promise.race([new Promise(resolve => child.once('exit', resolve)), delay(10_000)]);
    if (!childExited) {
      child.kill('SIGKILL');
      await Promise.race([new Promise(resolve => child.once('exit', resolve)), delay(2_000)]);
    }
  }
  rmSync(tempDir, { recursive: true, force: true });
  receipt.fixtureRemoved = !existsSync(tempDir);
  console.log(JSON.stringify(receipt));
}
