import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';
import {
  assertRollingDeploymentSupported,
  createCommandHealthcheck,
} from './coolify-deployment-settings.mjs';

const exec = promisify(execFile);
const require = createRequire(import.meta.url);
const { load } = createRequire(require.resolve('markdownlint-cli2'))('js-yaml');
const cli = fileURLToPath(new URL('./coolify-deployment-settings.mjs', import.meta.url));
const row = (key, value, flags = {}) => ({
  key,
  value,
  is_runtime: true,
  is_preview: false,
  ...flags,
});
const mysql = () => [row('DB_TYPE', 'mysql'), row('IDP_PROVIDER', 'better-auth')];

test('permits explicit MySQL with plugin and native auth fallback', () => {
  assert.doesNotThrow(() => assertRollingDeploymentSupported(mysql()));
});

test('rejects default, blank and explicit SQLite app persistence', () => {
  for (const value of [undefined, '', '  ', 'sqlite']) {
    const rows = [row('IDP_PROVIDER', 'better-auth')];
    if (value !== undefined) rows.push(row('DB_TYPE', value));
    assert.throws(() => assertRollingDeploymentSupported(rows), /stopped-writer rollout/);
  }
});

test('rejects SQLite plugin collections and native auth even when main uses MySQL', () => {
  for (const key of ['PLUGIN_COLLECTIONS_DB_TYPE', 'IDP_BETTER_AUTH_DATABASE_TYPE']) {
    assert.throws(
      () => assertRollingDeploymentSupported([...mysql(), row(key, 'sqlite')]),
      /stopped-writer/
    );
  }
});

test('uses plugin blank fallback but rejects native auth raw whitespace configuration', () => {
  assert.doesNotThrow(() =>
    assertRollingDeploymentSupported([...mysql(), row('PLUGIN_COLLECTIONS_DB_TYPE', '  ')])
  );
  assert.throws(
    () =>
      assertRollingDeploymentSupported([...mysql(), row('IDP_BETTER_AUTH_DATABASE_TYPE', '  ')]),
    /stopped-writer/
  );
});

test('ignores preview/build values and unrelated credential values', () => {
  assert.doesNotThrow(() =>
    assertRollingDeploymentSupported([
      ...mysql(),
      row('DB_TYPE', 'sqlite', { is_preview: true }),
      row('DB_TYPE', 'sqlite', { is_runtime: false }),
      row('IDP_BETTER_AUTH_SECRET', 'secret-not-for-output'),
    ])
  );
});

test('rejects ambiguous or malformed metadata without disclosing values', () => {
  for (const rows of [
    {},
    [null],
    [...mysql(), row('DB_TYPE', 'private-value')],
    [row('DB_TYPE', 'private-value', { is_preview: undefined })],
    [row('DB_TYPE', { password: 'private-value' })],
    [row('DB_TYPE', 'mysql')],
    [row('DB_TYPE', 'mysql'), row('IDP_PROVIDER', 'private-value')],
  ]) {
    assert.throws(
      () => assertRollingDeploymentSupported(rows),
      error => !error.message.includes('private-value')
    );
  }
});

test('ignores unused native auth storage for the external identity provider', () => {
  assert.doesNotThrow(() =>
    assertRollingDeploymentSupported([
      row('DB_TYPE', 'mysql'),
      row('IDP_PROVIDER', 'owox-better-auth'),
      row('IDP_BETTER_AUTH_DATABASE_TYPE', 'sqlite'),
    ])
  );
});

test('rejects unknown storage types and shell input in probe settings', () => {
  assert.throws(
    () =>
      assertRollingDeploymentSupported([
        row('DB_TYPE', 'postgres'),
        row('IDP_PROVIDER', 'better-auth'),
      ]),
    /stopped-writer/
  );
  for (const [path, port] of [
    ['/health;echo bad', 3000],
    ['/health', 0],
    ['/health', 65536],
    ['/health', 1.5],
  ]) {
    assert.throws(() => createCommandHealthcheck(path, port), /Invalid loopback/);
  }
});

async function probe(t, handler) {
  const server = createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const settings = createCommandHealthcheck('/health/ready', server.address().port);
  const script = settings.health_check_command.slice('node -e "'.length, -1);
  return () => exec(process.execPath, ['-e', script], { timeout: 7000 });
}

test('Node command succeeds on HTTP 200 without curl/wget or a mounted file', async t => {
  const run = await probe(t, (req, res) => {
    assert.equal(req.url, '/health/ready');
    res.end('ok');
  });
  await run();
});

test('CLI returns safe command JSON for both deployment probes', async () => {
  for (const [path, port] of [
    ['/health/ready', 3000],
    ['/healthz', 8091],
  ]) {
    const { stdout } = await exec(process.execPath, [cli, 'healthcheck', path, String(port)]);
    assert.deepEqual(JSON.parse(stdout), createCommandHealthcheck(path, port));
  }
});

test('CLI refuses malformed API input without printing credentials', async t => {
  const root = await mkdtemp(join(tmpdir(), 'owox-coolify-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, 'envs.json');
  await writeFile(path, '[{"value":"secret-not-for-output" invalid-json');
  await assert.rejects(exec(process.execPath, [cli, 'rolling-check', path]), error => {
    assert.equal(error.code, 1);
    assert.equal(error.stderr.trim(), 'Invalid Coolify environment JSON.');
    assert.equal(error.stdout, '');
    return true;
  });
});

test('Node command fails on HTTP errors, network failures and stalled readiness', async t => {
  const error = await probe(t, (_req, res) => {
    res.writeHead(503);
    res.end();
  });
  await assert.rejects(error(), { code: 1 });
  const network = await probe(t, req => req.socket.destroy());
  await assert.rejects(network(), { code: 1 });
  const stalled = await probe(t, () => {});
  await assert.rejects(stalled(), { code: 1 });
});

test('workflow checks storage before PATCH or deploy and uses command healthchecks', async () => {
  const workflow = load(
    await readFile(
      new URL('../.github/workflows/p2pdigital-production.yml', import.meta.url),
      'utf8'
    )
  );
  const steps = workflow.jobs['coolify-deploy'].steps;
  assert.equal(steps[0].uses, 'actions/checkout@v5');
  const shell = steps.find(step => step.name === 'Trigger Coolify deployments').run;
  const check = shell.lastIndexOf(
    'assert_rolling_deployment_supported "${COOLIFY_MAIN_RESOURCE_UUID}"'
  );
  assert.ok(check > 0 && check < shell.lastIndexOf('configure_resource "Admicro sidecar"'));
  assert.ok(shell.includes('applications/${uuid}/envs'));
  assert.ok(shell.includes('node tools/coolify-deployment-settings.mjs rolling-check'));
  assert.ok(shell.includes('node tools/coolify-deployment-settings.mjs healthcheck'));
  assert.ok(shell.includes('$healthcheck + {'));
  assert.ok(!shell.includes('health_check_type: "http"'));
  assert.ok(
    workflow.jobs.verify.steps.some(
      step => step.run === 'node --test tools/coolify-deployment-settings.test.mjs'
    )
  );
});
