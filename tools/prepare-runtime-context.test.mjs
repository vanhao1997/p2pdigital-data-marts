import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

import { prepareRuntimeContext } from './prepare-runtime-context.mjs';

const runtimeManifests = {
  'apps/owox': { name: 'owox', bin: { owox: './bin/run.js' } },
  'apps/backend': { name: '@owox/backend', main: './dist/src/index.js' },
  'apps/web': { name: '@owox/web', main: './dist/index.html' },
  'packages/connectors': {
    name: '@owox/connectors',
    bin: { 'owox-connector-runner': './dist/connector-runner.cjs' },
    exports: { '.': { import: './dist/index.js', require: './dist/index.cjs' } },
  },
  'packages/idp-protocol': { name: '@owox/idp-protocol', main: './dist/index.js' },
  'packages/idp-better-auth': { name: '@owox/idp-better-auth', main: './dist/index.js' },
  'packages/idp-owox-better-auth': { name: '@owox/idp-owox-better-auth', main: './dist/index.js' },
  'packages/internal-helpers': {
    name: '@owox/internal-helpers',
    main: './dist/index.js',
    exports: {
      '.': {
        import: './dist/index.js',
        require: './dist-cjs/index.js',
        types: './dist/index.d.ts',
      },
    },
  },
};

async function write(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, value);
}

async function writeJson(path, value) {
  await write(path, JSON.stringify(value, null, 2) + '\n');
}

async function fixture(t) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'owox-runtime-context-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  const manifests = {
    ...runtimeManifests,
    'packages/ui': { name: '@owox/ui' },
  };
  const rootManifest = {
    name: 'runtime-fixture',
    version: '1.0.0',
    private: true,
    workspaces: ['apps/*', 'packages/*'],
    scripts: { prepare: 'husky', postinstall: 'node tools/setup-husky.mjs' },
  };
  const lock = { lockfileVersion: 3, packages: { '': rootManifest } };
  for (const [workspace, manifest] of Object.entries(manifests)) {
    const packageManifest = { version: '1.0.0', type: 'module', ...manifest };
    await writeJson(join(root, workspace, 'package.json'), packageManifest);
    lock.packages[workspace] = packageManifest;
    lock.packages['node_modules/' + manifest.name] = { resolved: workspace, link: true };
  }
  await writeJson(join(root, 'package.json'), rootManifest);
  await writeJson(join(root, 'package-lock.json'), lock);
  const files = {
    'apps/owox/bin/run.js': '#!/usr/bin/env node\n',
    'apps/owox/dist/commands/serve.js': 'export default {};\n',
    'apps/owox/dist/commands/migrations/up.js': 'export default {};\n',
    'apps/owox/dist/commands/migrations/down.js': 'export default {};\n',
    'apps/owox/dist/commands/migrations/status.js': 'export default {};\n',
    'apps/backend/dist/src/index.js': 'module.exports = {};\n',
    'apps/web/dist/index.html': '<main>Runtime fixture</main>\n',
    'packages/connectors/dist/index.js': 'export default {};\n',
    'packages/connectors/dist/index.cjs': 'module.exports = {};\n',
    'packages/connectors/dist/connector-runner.cjs': '#!/usr/bin/env node\n',
    'packages/idp-protocol/dist/index.js': 'export default {};\n',
    'packages/idp-better-auth/dist/index.js': 'export default {};\n',
    'packages/idp-owox-better-auth/dist/index.js': 'export default {};\n',
    'packages/internal-helpers/dist/index.js': 'export default {};\n',
    'packages/internal-helpers/dist-cjs/index.js': 'module.exports = {};\n',
  };
  for (const [path, contents] of Object.entries(files)) await write(join(root, path), contents);
  await writeJson(join(root, 'packages/internal-helpers/dist-cjs/package.json'), {
    type: 'commonjs',
  });
  await writeJson(join(root, 'apps/owox/oclif.manifest.json'), {
    commands: {
      serve: {},
      'migrations:up': {},
      'migrations:down': {},
      'migrations:status': {},
    },
  });
  const output = join(root, 'output/runtime-context');
  return { root, output };
}

async function preserveContext(output) {
  await write(join(output, 'existing-context.txt'), 'preserve existing context');
}

async function assertPreserved(output) {
  assert.equal(
    await readFile(join(output, 'existing-context.txt'), 'utf8'),
    'preserve existing context'
  );
}

test('stages unchanged lockfile, all workspace manifests, CLI and both module formats without host files', async t => {
  const { root, output } = await fixture(t);
  await write(join(root, '.env'), 'fixture-token-do-not-copy');
  await write(join(root, 'packages/ui/src/index.js'), 'source not needed by runtime');
  await write(join(root, 'node_modules/host-only/index.js'), 'host dependency');

  const result = await prepareRuntimeContext(root, output);
  assert.equal(result.output, output);
  assert.equal(result.workspaces, 9);
  assert.equal(result.runtimeWorkspaces, 8);
  for (const path of [
    'package.json',
    'package-lock.json',
    'packages/ui/package.json',
    'apps/owox/bin/run.js',
    'apps/owox/oclif.manifest.json',
    'apps/owox/dist/commands/migrations/up.js',
    'apps/backend/dist/src/index.js',
    'apps/web/dist/index.html',
    'packages/connectors/dist/index.cjs',
    'packages/connectors/dist/connector-runner.cjs',
    'packages/internal-helpers/dist/index.js',
    'packages/internal-helpers/dist-cjs/index.js',
    'packages/internal-helpers/dist-cjs/package.json',
  ]) {
    assert.equal(
      await readFile(join(output, path), 'utf8'),
      await readFile(join(root, path), 'utf8')
    );
  }
  for (const path of ['.env', 'packages/ui/src/index.js', 'node_modules/host-only/index.js']) {
    await assert.rejects(readFile(join(output, path)), { code: 'ENOENT' });
  }
});

test('rejects checkout, output root and nested destinations before deleting existing files', async t => {
  const { root } = await fixture(t);
  await write(join(root, 'preserved.txt'), 'preserve checkout');
  await mkdir(join(root, 'output/nested'), { recursive: true });
  for (const output of [
    root,
    join(root, 'output'),
    join(root, 'apps/owox'),
    join(root, 'output/nested/context'),
  ]) {
    await assert.rejects(prepareRuntimeContext(root, output), /Runtime context/);
    assert.equal(await readFile(join(root, 'preserved.txt'), 'utf8'), 'preserve checkout');
    assert.ok(await readFile(join(root, 'apps/owox/bin/run.js')));
  }
});

test('missing exports, module boundaries and CLI commands preserve an existing context', async t => {
  for (const state of [
    'missing CommonJS export',
    'invalid CommonJS boundary',
    'missing serve command',
    'missing migration command',
    'missing migration artifact',
  ]) {
    await t.test(state, async t => {
      const { root, output } = await fixture(t);
      await preserveContext(output);
      if (state === 'missing CommonJS export') {
        await rm(join(root, 'packages/internal-helpers/dist-cjs/index.js'));
      } else if (state === 'invalid CommonJS boundary') {
        await writeJson(join(root, 'packages/internal-helpers/dist-cjs/package.json'), {
          type: 'module',
        });
      } else if (state === 'missing migration artifact') {
        await rm(join(root, 'apps/owox/dist/commands/migrations/up.js'));
      } else if (state === 'missing migration command') {
        await writeJson(join(root, 'apps/owox/oclif.manifest.json'), { commands: { serve: {} } });
      } else {
        await writeJson(join(root, 'apps/owox/oclif.manifest.json'), { commands: {} });
      }
      await assert.rejects(
        prepareRuntimeContext(root, output),
        /ENOENT|CommonJS export|serve command|migrations:up command/
      );
      await assertPreserved(output);
    });
  }
});

test('an existing entry point outside staged artifacts cannot produce an incomplete context', async t => {
  const { root, output } = await fixture(t);
  await preserveContext(output);
  await writeJson(join(root, 'apps/backend/package.json'), {
    ...runtimeManifests['apps/backend'],
    main: './uncompiled/main.js',
  });
  await write(join(root, 'apps/backend/uncompiled/main.js'), 'module.exports = {};');
  await assert.rejects(prepareRuntimeContext(root, output), /Runtime entry point is not staged/);
  await assertPreserved(output);
});

test('host dependencies and symbolic links inside artifacts are rejected before replacing the context', async t => {
  for (const state of ['host dependencies', 'symbolic link']) {
    await t.test(state, async t => {
      const { root, output } = await fixture(t);
      await preserveContext(output);
      if (state === 'host dependencies') {
        await write(
          join(root, 'apps/backend/dist/node_modules/host-only/index.js'),
          'host dependency'
        );
      } else {
        await write(join(root, 'host-code/preserved.txt'), 'host code');
        await symlink(
          join(root, 'host-code'),
          join(root, 'apps/backend/dist/linked-code'),
          'junction'
        );
      }
      await assert.rejects(prepareRuntimeContext(root, output), /build host|symbolic links/);
      await assertPreserved(output);
    });
  }
});

test('symbolic output roots and destinations preserve their target files', async t => {
  for (const location of ['output', 'output/runtime-context']) {
    await t.test(location, async t => {
      const { root, output } = await fixture(t);
      await write(join(root, 'durable/preserved.txt'), 'preserve link target');
      await mkdir(dirname(join(root, location)), { recursive: true });
      await symlink(join(root, 'durable'), join(root, location), 'junction');
      await assert.rejects(prepareRuntimeContext(root, output), /symbolic link/);
      assert.equal(
        await readFile(join(root, 'durable/preserved.txt'), 'utf8'),
        'preserve link target'
      );
    });
  }
});

test('missing authoritative workspace entries or manifests cannot yield dangling install links', async t => {
  for (const state of ['lockfile workspace missing', 'workspace manifest missing']) {
    await t.test(state, async t => {
      const { root, output } = await fixture(t);
      await preserveContext(output);
      if (state === 'lockfile workspace missing') {
        const lock = JSON.parse(await readFile(join(root, 'package-lock.json'), 'utf8'));
        delete lock.packages['apps/backend'];
        await writeJson(join(root, 'package-lock.json'), lock);
      } else {
        await rm(join(root, 'packages/ui/package.json'));
      }
      await assert.rejects(
        prepareRuntimeContext(root, output),
        /authoritative lockfile|Locked workspace manifest/
      );
      await assertPreserved(output);
    });
  }
});
