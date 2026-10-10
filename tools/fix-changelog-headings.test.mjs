import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { lint } from 'markdownlint/sync';

const script = fileURLToPath(new URL('./fix-changelog-headings.mjs', import.meta.url));

async function fixture(t, content) {
  const root = await mkdtemp(join(tmpdir(), 'owox-changelog-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, 'CHANGELOG.md');
  await writeFile(path, content);
  const run = async () => {
    execFileSync(process.execPath, [script], { cwd: root });
    return readFile(path, 'utf8');
  };
  return { run };
}

test('restores spacing after historical nested headings without changing release text', async t => {
  const original = [
    '# Changelog',
    '',
    '## 0.33.0',
    '',
    '### Minor Changes 0.33.0',
    '',
    '- abcdef0: Time Triggers',
    '',
    '  ## Benefits',
    '  - Save time',
    '',
    '  ## Scheduling Options',
    '  - **Daily**: Run each day',
    '',
  ].join('\n');
  const { run } = await fixture(t, original);
  const fixed = await run();
  assert.equal(
    fixed,
    original
      .replace('  ## Benefits\n', '  ## Benefits\n\n')
      .replace('  ## Scheduling Options\n', '  ## Scheduling Options\n\n')
  );
  assert.deepEqual(lint({ strings: { fixed }, config: { default: false, MD022: true } }).fixed, []);
  assert.equal(await run(), fixed);
});

test('preserves version suffix normalization for minor and patch notes', async t => {
  const original =
    '# Changelog\n\n## 0.33.0\n\n### Minor Changes\n\n- Feature\n\n### Patch Changes\n\n- Dependencies\n';
  const { run } = await fixture(t, original);
  assert.equal(
    await run(),
    original
      .replace('### Minor Changes', '### Minor Changes 0.33.0')
      .replace('### Patch Changes', '### Patch Changes 0.33.0')
  );
});

test('does not edit correctly spaced headings or headings inside fenced examples', async t => {
  const original =
    '# Changelog\n\n## 0.33.0\n\n### Minor Changes 0.33.0\n\n```markdown\n## Example\n- Keep example unchanged\n```\n';
  const { run } = await fixture(t, original);
  assert.equal(await run(), original);
});
