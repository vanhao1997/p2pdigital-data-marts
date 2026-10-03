import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { createServer as createHttpServer, get } from 'node:http';
import { createRequire } from 'node:module';
import { createServer as createNetServer } from 'node:net';
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

async function listenLoopback(t, server, errors) {
  const sockets = new Set();
  server.on('connection', socket => {
    sockets.add(socket);
    socket.on('error', error => errors.push(error));
    socket.once('close', () => sockets.delete(socket));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(
    () =>
      new Promise(resolve => {
        for (const socket of sockets) socket.destroy();
        server.close(resolve);
      })
  );
  return server.address().port;
}

test(
  'Databricks proxy chain supports patched FTP listings, PAC loading and caching',
  { timeout: 15000 },
  async t => {
    const require = createRequire(import.meta.url);
    const databricksRequire = createRequire(require.resolve('@databricks/sql'));
    const proxyRequire = createRequire(databricksRequire.resolve('proxy-agent'));
    const pacRequire = createRequire(proxyRequire.resolve('pac-proxy-agent'));
    const getUriRequire = createRequire(pacRequire.resolve('get-uri'));
    const { getUri } = pacRequire('get-uri');
    const { Client } = getUriRequire('basic-ftp');
    const { ProxyAgent } = databricksRequire('proxy-agent');
    assert.equal(getUriRequire('basic-ftp/package.json').version, '6.2.1');

    const errors = [];
    const proxyRequests = [];
    const proxyPort = await listenLoopback(
      t,
      createHttpServer((request, response) => {
        proxyRequests.push(request.url);
        response.end('FTP PAC proxy response');
      }),
      errors
    );
    const pac = 'function FindProxyForURL() { return "PROXY 127.0.0.1:' + proxyPort + '"; }';
    const commands = [];
    const ftpPort = await listenLoopback(
      t,
      createNetServer(control => {
        control.setEncoding('utf8');
        control.write('220 FTP dependency fixture\r\n');
        let buffer = '';
        let queue = Promise.resolve();
        let dataConnection;
        let supportsMlsd = true;
        const handleCommand = async line => {
          commands.push(line);
          const command = line.split(' ', 1)[0];
          switch (command) {
            case 'USER':
              supportsMlsd = line !== 'USER unix-list';
              control.write('331 Password required\r\n');
              break;
            case 'PASS':
              control.write('230 Logged in\r\n');
              break;
            case 'FEAT':
              control.write(
                supportsMlsd
                  ? '211-Features\r\n MLST type*;size*;modify*;\r\n211 End\r\n'
                  : '211 No extended features\r\n'
              );
              break;
            case 'OPTS':
            case 'TYPE':
            case 'STRU':
              control.write('200 Accepted\r\n');
              break;
            case 'MDTM':
              control.write('502 MDTM unsupported; use LIST\r\n');
              break;
            case 'EPSV':
              control.write('502 EPSV unsupported; use PASV\r\n');
              break;
            case 'PASV': {
              let acceptData;
              dataConnection = new Promise(resolve => {
                acceptData = resolve;
              });
              const dataPort = await listenLoopback(t, createNetServer(acceptData), errors);
              control.write(
                '227 Entering Passive Mode (127,0,0,1,' +
                  Math.floor(dataPort / 256) +
                  ',' +
                  (dataPort % 256) +
                  ')\r\n'
              );
              break;
            }
            case 'LIST':
            case 'MLSD':
            case 'RETR': {
              const data = await dataConnection;
              const content =
                command === 'MLSD'
                  ? 'type=file;size=' +
                    Buffer.byteLength(pac) +
                    ';modify=20260101120000; proxy.pac\r\n'
                  : command === 'LIST'
                    ? '-rw-r--r-- 1 ' +
                      'owner '.repeat(2000) +
                      'not-a-size Jan 01 2026 malformed.pac\r\n' +
                      '-rw-r--r-- 1 owner group ' +
                      Buffer.byteLength(pac) +
                      ' Jan 01 2026 proxy.pac\r\n'
                    : pac;
              control.write('150 Data transfer follows\r\n');
              data.end(content, () => control.write('226 Transfer complete\r\n'));
              break;
            }
            case 'QUIT':
              // Client.close sends QUIT and destroys its socket without awaiting a reply.
              // Sending a reply here would race with the peer close on Windows.
              control.end();
              break;
            default:
              throw new Error('Unexpected FTP fixture command: ' + line);
          }
        };
        control.on('data', chunk => {
          buffer += chunk;
          let end;
          while ((end = buffer.indexOf('\r\n')) >= 0) {
            const line = buffer.slice(0, end);
            buffer = buffer.slice(end + 2);
            queue = queue
              .then(() => handleCommand(line))
              .catch(error => {
                errors.push(error);
                control.destroy();
              });
          }
        });
      }),
      errors
    );
    const unixClient = new Client();
    t.after(() => unixClient.close());
    await unixClient.access({
      host: '127.0.0.1',
      port: ftpPort,
      user: 'unix-list',
      password: 'fixture-password',
    });
    const unixEntries = await unixClient.list('/');
    assert.deepEqual(
      unixEntries.map(entry => entry.name),
      ['proxy.pac']
    );
    assert.equal(unixEntries[0].size, Buffer.byteLength(pac));
    assert.equal(unixEntries[0].rawModifiedAt, 'Jan 01 2026');
    unixClient.close();
    assert.ok(commands.some(command => command.startsWith('LIST ')));
    assert.ok(commands.includes('EPSV'));
    assert.ok(commands.includes('PASV'));

    const ftpUri = 'ftp://fixture-user:fixture-password@127.0.0.1:' + ftpPort + '/proxy.pac';
    const stream = await getUri(ftpUri);
    let downloaded = '';
    for await (const chunk of stream) downloaded += chunk.toString();
    assert.equal(downloaded, pac);
    assert.ok(stream.lastModified instanceof Date);
    assert.ok(commands.includes('MDTM /proxy.pac'));
    assert.ok(commands.includes('MLSD /'));
    const downloadsBeforeCache = commands.filter(command => command.startsWith('RETR ')).length;
    await assert.rejects(getUri(ftpUri, { cache: stream }), { code: 'ENOTMODIFIED' });
    assert.equal(
      commands.filter(command => command.startsWith('RETR ')).length,
      downloadsBeforeCache
    );
    await assert.rejects(getUri(ftpUri.replace('/proxy.pac', '/missing.pac')), {
      code: 'ENOTFOUND',
    });

    const agent = new ProxyAgent({ getProxyForUrl: () => 'pac+' + ftpUri });
    t.after(() => agent.destroy());
    const target = 'http://ftp-pac-fixture.invalid/through-proxy';
    const body = await new Promise((resolve, reject) => {
      const request = get(target, { agent }, response => {
        let content = '';
        response.setEncoding('utf8');
        response.on('data', chunk => {
          content += chunk;
        });
        response.once('end', () => resolve(content));
        response.once('error', reject);
      });
      request.once('error', reject);
      request.setTimeout(5000, () =>
        request.destroy(new Error('FTP PAC fixture request timed out'))
      );
    });
    assert.equal(body, 'FTP PAC proxy response');
    assert.deepEqual(proxyRequests, [target]);
    assert.ok(commands.includes('USER fixture-user'));
    assert.ok(commands.includes('PASS fixture-password'));
    assert.ok(commands.filter(command => command === 'RETR /proxy.pac').length >= 2);
    assert.deepEqual(errors, []);
  }
);

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
