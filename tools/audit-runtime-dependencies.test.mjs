import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  collectInstalledDependencies,
  requestAdvisories,
  runCli,
} from './audit-runtime-dependencies.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'owox-runtime-audit-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

async function install(root, relativeDirectory, manifest) {
  const directory = join(root, relativeDirectory);
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, 'package.json'), JSON.stringify(manifest));
}

function advisoryResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

test('inventory includes scoped and nested packages, retaining versions and deduplicating copies', async t => {
  const root = await fixture(t);
  await install(root, 'node_modules/parent', { name: 'parent', version: '1.0.0' });
  await install(root, 'node_modules/axios', { name: 'axios', version: '1.20.0' });
  await install(root, 'node_modules/parent/node_modules/axios', {
    name: 'axios',
    version: '1.19.0',
  });
  await install(root, 'node_modules/@scope/other', { name: '@scope/other', version: '2.0.0' });
  await install(root, 'node_modules/@scope/other/node_modules/axios', {
    name: 'axios',
    version: '1.20.0',
  });
  await mkdir(join(root, 'node_modules/.bin'), { recursive: true });

  const inventory = await collectInstalledDependencies(root);
  assert.deepEqual(inventory.packages, {
    '@scope/other': ['2.0.0'],
    axios: ['1.19.0', '1.20.0'],
    parent: ['1.0.0'],
  });
  assert.equal(inventory.packageCopies, 5);
  assert.equal(inventory.uniqueVersions, 4);
});

test('empty, missing and malformed installed metadata fail closed', async t => {
  for (const state of ['missing', 'empty', 'malformed', 'invalid version']) {
    await t.test(state, async t => {
      const root = await fixture(t);
      if (state !== 'missing') await mkdir(join(root, 'node_modules'), { recursive: true });
      if (state === 'malformed') {
        await mkdir(join(root, 'node_modules/broken'), { recursive: true });
        await writeFile(join(root, 'node_modules/broken/package.json'), 'not JSON');
      }
      if (state === 'invalid version') {
        await install(root, 'node_modules/broken', {
          name: 'broken',
          version: 'file:secret-location',
        });
      }
      await assert.rejects(collectInstalledDependencies(root), /inventory|metadata/);
    });
  }
});

test('package and scope symlink cycles terminate without losing installed dependencies', async t => {
  const root = await fixture(t);
  await install(root, 'node_modules/parent', { name: 'parent', version: '1.0.0' });
  await install(root, 'node_modules/parent/node_modules/axios', {
    name: 'axios',
    version: '1.20.0',
  });
  await symlink(
    join(root, 'node_modules/parent'),
    join(root, 'node_modules/parent/node_modules/loop'),
    'junction'
  );
  await symlink(join(root, 'node_modules'), join(root, 'node_modules/@linked'), 'junction');
  const inventory = await collectInstalledDependencies(root);
  assert.deepEqual(inventory.packages, { axios: ['1.20.0'], parent: ['1.0.0'] });
  assert.equal(inventory.packageCopies, 2);
});

test('clean CLI sends only names and exact versions to official npm bulk endpoint', async t => {
  const root = await fixture(t);
  await install(root, 'node_modules/axios', {
    name: 'axios',
    version: '1.20.0',
    scripts: { secret: 'source-and-credential-content' },
    environment: { token: 'fixture-secret' },
  });
  const output = [];
  const errors = [];
  const code = await runCli(['--root', root], {
    writeOut: message => output.push(message),
    writeError: message => errors.push(message),
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://registry.npmjs.org/-/npm/v1/security/advisories/bulk');
      assert.equal(options.method, 'POST');
      assert.equal(options.redirect, 'error');
      assert.deepEqual(JSON.parse(options.body), { axios: ['1.20.0'] });
      assert.deepEqual(options.headers, {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      });
      assert.ok(options.signal instanceof AbortSignal);
      return advisoryResponse({});
    },
  });
  assert.equal(code, 0);
  assert.match(output.join('\n'), /1 installed copies; 1 unique name\/version pairs; 0 advisories/);
  assert.deepEqual(errors, []);
});

test('advisories fail CLI with concise metadata and no registry title or URL output', async t => {
  const root = await fixture(t);
  await install(root, 'node_modules/axios', { name: 'axios', version: '1.19.0' });
  const errors = [];
  const code = await runCli(['--root', root], {
    writeOut: () => assert.fail('A vulnerable inventory must not be reported as passed.'),
    writeError: message => errors.push(message),
    fetchImpl: async () =>
      advisoryResponse({
        axios: [
          {
            id: 12345,
            severity: 'high',
            vulnerable_versions: '<1.20.0',
            name: 'axios',
            title: 'untrusted payload',
            url: 'https://example.invalid/private',
          },
        ],
      }),
  });
  assert.equal(code, 1);
  assert.match(errors.join('\n'), /1 advisories/);
  assert.match(errors.join('\n'), /axios: high \(npm advisory 12345\)/);
  assert.doesNotMatch(errors.join('\n'), /untrusted payload|example\.invalid/);
});

test('HTTP failures and transport rejection cannot pass an audit or expose raw errors', async t => {
  for (const fetchImpl of [
    async () => advisoryResponse({ message: 'private response' }, 503),
    async () => {
      throw new Error('fixture-secret in a transport error');
    },
  ]) {
    const root = await fixture(t);
    await install(root, 'node_modules/axios', { name: 'axios', version: '1.20.0' });
    const errors = [];
    const code = await runCli(['--root', root], {
      fetchImpl,
      writeOut: () => assert.fail('Unavailable advisory service must not pass.'),
      writeError: message => errors.push(message),
    });
    assert.equal(code, 1);
    assert.match(errors.join('\n'), /Runtime dependency audit failed:/);
    assert.doesNotMatch(errors.join('\n'), /fixture-secret|private response/);
  }
});

test('invalid JSON and structurally invalid registry answers fail closed', async t => {
  const invalidBodies = [
    'not JSON',
    'null',
    '[]',
    '"unavailable"',
    '{"unknown-package":[]}',
    '{"axios":{}}',
    '{"axios":[{}]}',
    '{"axios":[{"id":1,"severity":"unknown","vulnerable_versions":"*"}]}',
    '{"axios":[{"id":1,"severity":"high","vulnerable_versions":"*","name":"other"}]}',
  ];
  for (const body of invalidBodies) {
    await t.test(body, async () => {
      await assert.rejects(
        requestAdvisories({ axios: ['1.20.0'] }, async () => new Response(body)),
        /invalid/
      );
    });
  }
});
