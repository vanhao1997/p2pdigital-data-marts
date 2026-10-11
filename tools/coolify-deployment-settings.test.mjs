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
  COOLIFY_HEALTHCHECK_COMMAND_PATTERN,
  createCommandHealthcheck,
  RUNTIME_HEALTHCHECK_COMMAND,
} from './coolify-deployment-settings.mjs';

const exec = promisify(execFile);
const require = createRequire(import.meta.url);
const { load } = createRequire(require.resolve('markdownlint-cli2'))('js-yaml');
const cli = fileURLToPath(new URL('./coolify-deployment-settings.mjs', import.meta.url));
const bundledHealthcheck = fileURLToPath(
  new URL('../deploy/healthchecks/http-healthcheck.cjs', import.meta.url)
);
const sidecarHealthcheck = fileURLToPath(
  new URL('../apps/admicro-extractor/healthcheck.cjs', import.meta.url)
);
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

test('emits a Coolify regex-safe bundled healthcheck command', () => {
  const settings = createCommandHealthcheck('/health/ready', 3000);
  assert.deepEqual(settings, {
    health_check_type: 'cmd',
    health_check_command: `${RUNTIME_HEALTHCHECK_COMMAND} /health/ready 3000`,
  });
  assert.match(settings.health_check_command, COOLIFY_HEALTHCHECK_COMMAND_PATTERN);
  assert.ok(!settings.health_check_command.includes('node -e'));
  assert.ok(!settings.health_check_command.includes('"'));
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
  assert.match(settings.health_check_command, COOLIFY_HEALTHCHECK_COMMAND_PATTERN);
  assert.equal(
    settings.health_check_command,
    `${RUNTIME_HEALTHCHECK_COMMAND} /health/ready ${server.address().port}`
  );
  return () =>
    exec(process.execPath, [bundledHealthcheck, '/health/ready', String(server.address().port)], {
      timeout: 7000,
      env: { ...process.env, PORT: '' },
    });
}

test('bundled Node command succeeds on HTTP 200 without curl/wget', async t => {
  const run = await probe(t, (req, res) => {
    assert.equal(req.url, '/health/ready');
    res.end('ok');
  });
  await run();
});

test('both bundled probes preserve the runtime PORT override', async t => {
  const server = createServer((req, res) => {
    assert.equal(req.url, '/health/ready');
    res.end('ok');
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  for (const script of [bundledHealthcheck, sidecarHealthcheck]) {
    await exec(process.execPath, [script, '/health/ready', '0'], {
      timeout: 7000,
      env: { ...process.env, PORT: String(server.address().port) },
    });
    for (const port of ['bad', ' ', '0', '65536', '1.5']) {
      await assert.rejects(
        exec(process.execPath, [script, '/health/ready', '3000'], {
          env: { ...process.env, PORT: port },
        }),
        { code: 1 }
      );
    }
  }
});

test('main and standalone sidecar probes stay identical', async () => {
  assert.equal(
    await readFile(bundledHealthcheck, 'utf8'),
    await readFile(sidecarHealthcheck, 'utf8')
  );
});

test('CLI returns safe command JSON for both deployment probes', async () => {
  for (const [path, port] of [
    ['/health/ready', 3000],
    ['/healthz', 8091],
  ]) {
    const { stdout } = await exec(process.execPath, [cli, 'healthcheck', path, String(port)]);
    const settings = JSON.parse(stdout);
    assert.deepEqual(settings, createCommandHealthcheck(path, port));
    assert.match(settings.health_check_command, COOLIFY_HEALTHCHECK_COMMAND_PATTERN);
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

test('probe rejects other successful statuses and redirects to HTTP 200', async t => {
  for (const status of [201, 204, 301, 302, 307, 308]) {
    const run = await probe(t, (req, res) => {
      if (req.url === '/redirect-target') {
        res.end('ok');
        return;
      }
      res.writeHead(status, { Location: '/redirect-target' });
      res.end();
    });
    await assert.rejects(run(), { code: 1 });
  }
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
  const imageSteps = workflow.jobs.images.steps;
  const mainSmoke = imageSteps.find(step => step.name === 'Smoke main runtime healthcheck').run;
  const sidecarSmoke = imageSteps.find(
    step => step.name === 'Smoke Admicro sidecar healthcheck'
  ).run;
  assert.ok(
    mainSmoke.includes(
      'docker exec owox-runtime-smoke node /usr/local/bin/owox-http-healthcheck.cjs /health/ready 3000'
    )
  );
  assert.ok(
    sidecarSmoke.includes(
      'docker exec admicro-extractor-smoke node /usr/local/bin/owox-http-healthcheck.cjs /healthz 8091'
    )
  );
  assert.ok(!mainSmoke.includes('curl --fail --silent http://127.0.0.1:3000'));
  assert.ok(!sidecarSmoke.includes('curl --fail --silent http://127.0.0.1:8091'));
});

test('runtime Dockerfiles use the bundled healthcheck script', async () => {
  const [main, sidecar] = await Promise.all([
    readFile(new URL('../Dockerfile', import.meta.url), 'utf8'),
    readFile(new URL('../apps/admicro-extractor/Dockerfile', import.meta.url), 'utf8'),
  ]);
  assert.ok(
    main.includes(
      'COPY deploy/healthchecks/http-healthcheck.cjs /usr/local/bin/owox-http-healthcheck.cjs'
    )
  );
  assert.ok(
    main.includes(
      'HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node /usr/local/bin/owox-http-healthcheck.cjs /health/ready 3000'
    )
  );
  assert.ok(sidecar.includes('COPY healthcheck.cjs /usr/local/bin/owox-http-healthcheck.cjs'));
  assert.ok(
    sidecar.includes(
      'HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD node /usr/local/bin/owox-http-healthcheck.cjs /healthz 8091'
    )
  );
  const mainHealthcheck = main.split('\n').find(line => line.startsWith('HEALTHCHECK '));
  const sidecarHealthcheck = sidecar.split('\n').find(line => line.startsWith('HEALTHCHECK '));
  assert.ok(mainHealthcheck);
  assert.ok(sidecarHealthcheck);
  assert.ok(!mainHealthcheck.includes('node -e'));
  assert.ok(!sidecarHealthcheck.includes('node -e'));
});
