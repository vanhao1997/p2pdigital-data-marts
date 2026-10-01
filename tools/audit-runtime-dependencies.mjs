import { readdir, readFile, realpath } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ADVISORY_ENDPOINT = 'https://registry.npmjs.org/-/npm/v1/security/advisories/bulk';
const PACKAGE_NAME = /^(?:@[A-Za-z0-9._~-]+\/)?[A-Za-z0-9._~-]+$/;
const PACKAGE_VERSION = /^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?(?:\+[A-Za-z0-9.-]+)?$/;
const SEVERITIES = new Set(['info', 'low', 'moderate', 'high', 'critical']);
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;

export class RuntimeAuditError extends Error {}

/** Read installed package copies, including nested node_modules and symlinks. */
export async function collectInstalledDependencies(runtimeRoot) {
  const versionsByName = new Map();
  const visitedPackages = new Set();
  const visitedModuleDirectories = new Set();

  async function visitPackage(directory) {
    let canonicalDirectory;
    let manifest;
    try {
      canonicalDirectory = await realpath(directory);
      if (visitedPackages.has(canonicalDirectory)) return;
      visitedPackages.add(canonicalDirectory);
      manifest = JSON.parse(await readFile(join(canonicalDirectory, 'package.json'), 'utf8'));
    } catch (cause) {
      throw new RuntimeAuditError('Cannot read installed package metadata.', { cause });
    }

    if (
      !manifest ||
      typeof manifest.name !== 'string' ||
      manifest.name.length > 214 ||
      !PACKAGE_NAME.test(manifest.name) ||
      typeof manifest.version !== 'string' ||
      manifest.version.length > 128 ||
      !PACKAGE_VERSION.test(manifest.version)
    ) {
      throw new RuntimeAuditError('Installed package metadata has an invalid name or version.');
    }

    if (!versionsByName.has(manifest.name)) versionsByName.set(manifest.name, new Set());
    versionsByName.get(manifest.name).add(manifest.version);
    await visitNodeModules(join(canonicalDirectory, 'node_modules'));
  }

  async function visitNodeModules(directory, required = false) {
    let entries;
    try {
      const canonicalDirectory = await realpath(directory);
      if (visitedModuleDirectories.has(canonicalDirectory)) return;
      visitedModuleDirectories.add(canonicalDirectory);
      entries = await readdir(directory, { withFileTypes: true });
    } catch (cause) {
      if (!required && cause.code === 'ENOENT') return;
      throw new RuntimeAuditError('Cannot read installed node_modules inventory.', { cause });
    }

    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name.startsWith('.') || (!entry.isDirectory() && !entry.isSymbolicLink())) continue;
      const packageDirectory = join(directory, entry.name);
      if (entry.name.startsWith('@')) {
        await visitNodeModules(packageDirectory, true);
      } else {
        await visitPackage(packageDirectory);
      }
    }
  }

  await visitNodeModules(join(resolve(runtimeRoot), 'node_modules'), true);
  if (versionsByName.size === 0) {
    throw new RuntimeAuditError('Installed dependency inventory is empty; audit cannot pass.');
  }

  const packages = Object.fromEntries(
    [...versionsByName.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, versions]) => [name, [...versions].sort()])
  );
  return {
    packages,
    packageCopies: visitedPackages.size,
    uniqueVersions: Object.values(packages).reduce((total, versions) => total + versions.length, 0),
  };
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Submit only package names and installed versions, never full manifests. */
export async function requestAdvisories(packages, fetchImpl = globalThis.fetch) {
  let response;
  let body;
  try {
    response = await fetchImpl(ADVISORY_ENDPOINT, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify(packages),
    });
    if (!response.ok) {
      throw new RuntimeAuditError('npm advisory service returned HTTP ' + response.status + '.');
    }
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) {
      throw new RuntimeAuditError('npm advisory response exceeded the permitted size.');
    }
    body = JSON.parse(text);
  } catch (cause) {
    if (cause instanceof RuntimeAuditError) throw cause;
    throw new RuntimeAuditError('npm advisory service unavailable or returned invalid JSON.', {
      cause,
    });
  }

  if (!isRecord(body)) throw new RuntimeAuditError('npm advisory response has an invalid shape.');
  const advisories = [];
  for (const [name, entries] of Object.entries(body)) {
    if (!Object.hasOwn(packages, name) || !Array.isArray(entries)) {
      throw new RuntimeAuditError('npm advisory response has an invalid package entry.');
    }
    for (const advisory of entries) {
      if (
        !isRecord(advisory) ||
        !Number.isSafeInteger(advisory.id) ||
        advisory.id <= 0 ||
        !SEVERITIES.has(advisory.severity) ||
        typeof advisory.vulnerable_versions !== 'string' ||
        advisory.vulnerable_versions.length === 0 ||
        advisory.vulnerable_versions.length > 4096 ||
        (advisory.name !== undefined && advisory.name !== name)
      ) {
        throw new RuntimeAuditError('npm advisory response contains invalid advisory metadata.');
      }
      advisories.push({ name, id: advisory.id, severity: advisory.severity });
    }
  }
  return advisories.sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id);
}

export async function auditRuntimeDependencies(runtimeRoot, fetchImpl = globalThis.fetch) {
  const inventory = await collectInstalledDependencies(runtimeRoot);
  const advisories = await requestAdvisories(inventory.packages, fetchImpl);
  return { ...inventory, advisories };
}

export async function runCli(args, options = {}) {
  const writeOut = options.writeOut ?? (message => console.log(message));
  const writeError = options.writeError ?? (message => console.error(message));
  if (args.length !== 2 || args[0] !== '--root' || !args[1]) {
    writeError('Usage: node audit-runtime-dependencies.mjs --root <installed-runtime-directory>');
    return 1;
  }
  try {
    const result = await auditRuntimeDependencies(args[1], options.fetchImpl);
    const inventorySummary =
      result.packageCopies +
      ' installed copies; ' +
      result.uniqueVersions +
      ' unique name/version pairs';
    if (result.advisories.length > 0) {
      writeError(
        'Runtime dependency audit failed: ' +
          result.advisories.length +
          ' advisories; ' +
          inventorySummary +
          '.'
      );
      for (const advisory of result.advisories) {
        writeError(
          '- ' + advisory.name + ': ' + advisory.severity + ' (npm advisory ' + advisory.id + ').'
        );
      }
      return 1;
    }
    writeOut('Runtime dependency audit passed: ' + inventorySummary + '; 0 advisories.');
    return 0;
  } catch (error) {
    // Filesystem and transport errors may contain local paths or response data.
    const message =
      error instanceof RuntimeAuditError ? error.message : 'Unexpected audit failure.';
    writeError('Runtime dependency audit failed: ' + message);
    return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await runCli(process.argv.slice(2));
}
