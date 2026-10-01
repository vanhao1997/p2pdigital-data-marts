import { cp, lstat, mkdir, readFile, readdir, realpath, rm } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// These are the built workspaces loaded by `owox serve`, its migration commands,
// and its connector subprocess. Keep their original paths for npm workspace links.
export const RUNTIME_ARTIFACTS = Object.freeze({
  'apps/owox': ['bin', 'dist', 'oclif.manifest.json'],
  'apps/backend': ['dist'],
  'apps/web': ['dist'],
  'packages/connectors': ['dist'],
  'packages/idp-protocol': ['dist'],
  'packages/idp-better-auth': ['dist'],
  'packages/idp-owox-better-auth': ['dist'],
  'packages/internal-helpers': ['dist', 'dist-cjs'],
});

function containedPath(root, entry) {
  const target = resolve(root, entry);
  const within = relative(root, target);
  if (!within || within === '..' || within.startsWith('..' + sep) || isAbsolute(within)) {
    throw new Error('Runtime context path must stay within its workspace: ' + entry);
  }
  return target;
}

async function artifactMetadata(source) {
  const metadata = await lstat(source);
  if (metadata.isSymbolicLink()) {
    throw new Error('Runtime source artifacts must not contain symbolic links.');
  }
  if (source.split(sep).includes('node_modules')) {
    throw new Error('Installed dependencies must not be copied from the build host.');
  }
  if (!metadata.isFile() && !metadata.isDirectory()) {
    throw new Error('Runtime source artifacts must be regular files or directories.');
  }
  return metadata;
}

async function validateArtifact(source) {
  const metadata = await artifactMetadata(source);
  if (metadata.isDirectory()) {
    for (const entry of await readdir(source)) await validateArtifact(join(source, entry));
  }
}

async function copyArtifact(source, destination) {
  await cp(source, destination, {
    recursive: true,
    filter: async file => {
      await artifactMetadata(file);
      return true;
    },
  });
}

async function requireFile(workspaceRoot, entry) {
  const target = containedPath(workspaceRoot, entry);
  const metadata = await lstat(target);
  if (!metadata.isFile()) throw new Error('Required runtime file is missing: ' + entry);
}

function exportTargets(value) {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(exportTargets);
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .filter(([condition]) => condition !== 'types')
      .flatMap(([, target]) => exportTargets(target));
  }
  return [];
}

/** Stage manifests and built code; npm ci installs Linux dependencies in Docker. */
export async function prepareRuntimeContext(repositoryRoot, destination) {
  const root = await realpath(repositoryRoot);
  const outputRoot = join(root, 'output');
  await mkdir(outputRoot, { recursive: true });
  if ((await realpath(outputRoot)) !== outputRoot) {
    throw new Error('Runtime output directory must not be a symbolic link.');
  }
  const output = containedPath(outputRoot, relative(outputRoot, resolve(destination)));
  // Only a named descendant of the repository's ignored output directory can
  // be replaced. Never clear the checkout or arbitrary user directories.
  const existing = await lstat(output).catch(error => {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  });
  if (existing?.isSymbolicLink()) {
    throw new Error('Runtime context destination must not be a symbolic link.');
  }
  const parent = await realpath(dirname(output));
  if (parent !== outputRoot) {
    throw new Error('Runtime context must be a direct child of the output directory.');
  }

  const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  const lock = JSON.parse(await readFile(join(root, 'package-lock.json'), 'utf8'));
  if (
    JSON.stringify(manifest.workspaces) !== JSON.stringify(['apps/*', 'packages/*']) ||
    lock.lockfileVersion !== 3 ||
    !lock.packages
  ) {
    throw new Error('Runtime context requires the declared npm workspace layout and v3 lockfile.');
  }

  const workspaces = new Map();
  for (const group of ['apps', 'packages']) {
    const entries = await readdir(join(root, group), { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (!entry.isDirectory()) continue;
      const workspace = group + '/' + entry.name;
      let packageManifest;
      try {
        packageManifest = JSON.parse(await readFile(join(root, workspace, 'package.json'), 'utf8'));
      } catch (error) {
        if (error.code === 'ENOENT') continue;
        throw error;
      }
      if (!lock.packages[workspace]) {
        throw new Error('Workspace is missing from the authoritative lockfile: ' + workspace);
      }
      workspaces.set(workspace, packageManifest);
    }
  }

  for (const lockedPackage of Object.values(lock.packages)) {
    if (lockedPackage.link && !workspaces.has(lockedPackage.resolved)) {
      throw new Error('Locked workspace manifest is missing: ' + lockedPackage.resolved);
    }
  }

  // Validate before replacing any existing context. Conditional CommonJS/ESM
  // exports must both exist, including internal-helpers/dist-cjs/package.json.
  for (const [workspace, artifacts] of Object.entries(RUNTIME_ARTIFACTS)) {
    const packageManifest = workspaces.get(workspace);
    if (!packageManifest) throw new Error('Required runtime workspace is missing: ' + workspace);
    const workspaceRoot = join(root, workspace);
    for (const artifact of artifacts) {
      await validateArtifact(containedPath(workspaceRoot, artifact));
    }
    const bin =
      typeof packageManifest.bin === 'string'
        ? [packageManifest.bin]
        : Object.values(packageManifest.bin ?? {});
    for (const target of [
      packageManifest.main,
      ...bin,
      ...exportTargets(packageManifest.exports),
    ]) {
      if (!target) continue;
      const entry = relative(workspaceRoot, containedPath(workspaceRoot, target));
      if (!artifacts.some(artifact => entry === artifact || entry.startsWith(artifact + sep))) {
        throw new Error('Runtime entry point is not staged: ' + workspace + '/' + target);
      }
      await requireFile(workspaceRoot, target);
    }
  }
  await requireFile(join(root, 'packages/internal-helpers'), 'dist-cjs/package.json');
  const cjsManifest = JSON.parse(
    await readFile(join(root, 'packages/internal-helpers/dist-cjs/package.json'), 'utf8')
  );
  if (cjsManifest.type !== 'commonjs') {
    throw new Error('Internal helper CommonJS export must retain its module boundary.');
  }
  const cliManifest = JSON.parse(
    await readFile(join(root, 'apps/owox/oclif.manifest.json'), 'utf8')
  );
  for (const command of ['serve', 'migrations:up', 'migrations:down', 'migrations:status']) {
    await requireFile(
      join(root, 'apps/owox'),
      'dist/commands/' + command.replace(':', '/') + '.js'
    );
    if (!cliManifest.commands?.[command]) {
      throw new Error('CLI manifest must contain the ' + command + ' command.');
    }
  }

  for (const filename of ['package.json', 'package-lock.json']) {
    await validateArtifact(join(root, filename));
  }
  for (const workspace of workspaces.keys()) {
    await validateArtifact(join(root, workspace, 'package.json'));
  }

  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  for (const filename of ['package.json', 'package-lock.json']) {
    await copyArtifact(join(root, filename), join(output, filename));
  }
  for (const workspace of workspaces.keys()) {
    await mkdir(join(output, workspace), { recursive: true });
    await copyArtifact(
      join(root, workspace, 'package.json'),
      join(output, workspace, 'package.json')
    );
  }
  for (const [workspace, artifacts] of Object.entries(RUNTIME_ARTIFACTS)) {
    for (const artifact of artifacts) {
      await copyArtifact(join(root, workspace, artifact), join(output, workspace, artifact));
    }
  }
  return {
    output,
    workspaces: workspaces.size,
    runtimeWorkspaces: Object.keys(RUNTIME_ARTIFACTS).length,
  };
}

export async function runCli(args) {
  if (args.length !== 2 || args[0] !== '--output' || !args[1]) {
    console.error('Usage: node tools/prepare-runtime-context.mjs --output output/runtime-context');
    return 1;
  }
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  try {
    const result = await prepareRuntimeContext(root, resolve(args[1]));
    console.log(
      'Prepared runtime context: ' +
        result.runtimeWorkspaces +
        ' built workspaces; ' +
        result.workspaces +
        ' workspace manifests; unchanged npm lockfile.'
    );
    return 0;
  } catch (error) {
    console.error('Cannot prepare runtime context: ' + error.message);
    return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await runCli(process.argv.slice(2));
}
