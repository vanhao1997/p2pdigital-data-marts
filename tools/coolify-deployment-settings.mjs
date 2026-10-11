import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const COOLIFY_HEALTHCHECK_COMMAND_PATTERN = /^[a-zA-Z0-9 \-_./:=@,+]+$/;
export const RUNTIME_HEALTHCHECK_COMMAND = 'node /usr/local/bin/owox-http-healthcheck.cjs';

export function createCommandHealthcheck(path, port) {
  if (!/^\/[a-z0-9/-]+$/.test(path) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Invalid loopback healthcheck path or port.');
  }
  const command = `${RUNTIME_HEALTHCHECK_COMMAND} ${path} ${port}`;
  if (!COOLIFY_HEALTHCHECK_COMMAND_PATTERN.test(command)) {
    throw new Error('Invalid Coolify command healthcheck.');
  }
  return {
    health_check_type: 'cmd',
    health_check_command: command,
  };
}

export function assertRollingDeploymentSupported(rows) {
  if (!Array.isArray(rows)) throw new Error('Invalid Coolify environment response.');
  const keys = new Set([
    'DB_TYPE',
    'PLUGIN_COLLECTIONS_DB_TYPE',
    'IDP_PROVIDER',
    'IDP_BETTER_AUTH_DATABASE_TYPE',
  ]);
  const env = new Map();
  for (const row of rows) {
    if (!row || typeof row !== 'object') throw new Error('Invalid Coolify environment row.');
    if (!keys.has(row.key)) continue;
    if (typeof row.is_runtime !== 'boolean' || typeof row.is_preview !== 'boolean') {
      throw new Error('Coolify environment flags are missing or invalid.');
    }
    if (!row.is_runtime || row.is_preview) continue;
    if (env.has(row.key) || typeof row.value !== 'string') {
      throw new Error('Invalid Coolify runtime database setting.');
    }
    env.set(row.key, row.value);
  }

  // App/plugin config trims blanks; the native auth factory uses raw fallback values.
  const main = env.get('DB_TYPE')?.trim() || 'sqlite';
  const collections = env.get('PLUGIN_COLLECTIONS_DB_TYPE')?.trim() || main;
  const provider = env.get('IDP_PROVIDER')?.trim();
  const auth = env.get('IDP_BETTER_AUTH_DATABASE_TYPE') || env.get('DB_TYPE') || 'sqlite';
  if (!['better-auth', 'owox-better-auth', 'none'].includes(provider)) {
    throw new Error('An explicit supported IDP_PROVIDER is required before deployment.');
  }
  if (
    main !== 'mysql' ||
    collections !== 'mysql' ||
    (provider === 'better-auth' && auth !== 'mysql')
  ) {
    throw new Error(
      'Rolling deployment requires MySQL for app, plugin collections and native auth databases. ' +
        'SQLite/default or unknown storage requires a controlled stopped-writer rollout with backup. ' +
        'No resources have been modified or deployments queued.'
    );
  }
}

export async function runCli(args) {
  if (args[0] === 'healthcheck' && args.length === 3) {
    console.log(JSON.stringify(createCommandHealthcheck(args[1], Number(args[2]))));
    return;
  }
  if (args[0] === 'rolling-check' && args.length === 2) {
    assertRollingDeploymentSupported(JSON.parse(await readFile(args[1], 'utf8')));
    console.log('Rolling deployment database checks passed.');
    return;
  }
  throw new Error(
    'Usage: coolify-deployment-settings.mjs healthcheck <path> <port> | rolling-check <env-response-file>'
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await runCli(process.argv.slice(2));
  } catch (error) {
    // Parser messages can include credential-bearing input from the API response.
    console.error(
      error instanceof SyntaxError ? 'Invalid Coolify environment JSON.' : error.message
    );
    process.exitCode = 1;
  }
}
