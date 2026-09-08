import http from 'node:http';

const port = Number(process.env.PORT || 8099);

function writeJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function requestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 64 * 1024) reject(new Error('request too large'));
    });
    req.on('end', () => {
      try {
        if (!body) {
          resolve({});
          return;
        }
        if (req.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
          resolve(Object.fromEntries(new URLSearchParams(body).entries()));
          return;
        }
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('invalid body'));
      }
    });
    req.on('error', reject);
  });
}

function requestUrl(req) {
  return new URL(req.url, 'http://127.0.0.1');
}

function queryValue(url, key) {
  return url.searchParams.get(key);
}

const server = http.createServer(async (req, res) => {
  const url = requestUrl(req);
  if (req.method === 'GET' && url.pathname === '/healthz') return writeJson(res, 200, { ok: true });

  let body;
  if (req.method === 'POST') {
    try {
      body = await requestBody(req);
    } catch {
      return writeJson(res, 400, { error: 'invalid body' });
    }
  } else {
    body = Object.fromEntries(url.searchParams.entries());
  }

  if (req.method === 'POST' && url.pathname === '/google/oauth/token') {
    const code = body.code || queryValue(url, 'code');
    const refreshToken = body.refresh_token || queryValue(url, 'refresh_token');
    if (code === 'sandbox-denied') {
      return writeJson(res, 400, { error: 'access_denied', error_description: 'Sandbox denied' });
    }
    if (code === 'sandbox-expired' || refreshToken === 'sandbox-expired') {
      return writeJson(res, 400, { error: 'invalid_grant', error_description: 'Sandbox expired' });
    }
    return writeJson(res, 200, {
      access_token: 'sandbox-google-access',
      refresh_token: 'sandbox-google-refresh',
      expires_in: 3600,
    });
  }
  if (req.method === 'GET' && url.pathname === '/google/userinfo') {
    return writeJson(res, 200, { id: 'sandbox-google-user', email: 'sandbox@example.test' });
  }
  if (req.method === 'GET' && url.pathname === '/facebook/debug_token') {
    const inputToken = queryValue(url, 'input_token');
    if (inputToken === 'sandbox-denied') {
      return writeJson(res, 200, {
        data: { is_valid: false, error: { code: 200, message: 'Permissions denied' } },
      });
    }
    if (inputToken === 'sandbox-expired') {
      return writeJson(res, 200, {
        data: { is_valid: false, error: { code: 190, message: 'Session expired' } },
      });
    }
    return writeJson(res, 200, { data: { is_valid: true, app_id: 'sandbox-app' } });
  }
  if (req.method === 'GET' && url.pathname === '/facebook/v25.0/oauth/access_token') {
    return writeJson(res, 200, { access_token: 'sandbox-facebook-access', expires_in: 3600 });
  }
  if (req.method === 'GET' && url.pathname === '/facebook/v25.0/me') {
    return writeJson(res, 200, { id: 'sandbox-facebook-user', name: 'Sandbox User' });
  }
  if (req.method === 'GET' && url.pathname === '/facebook/v25.0/me/adaccounts') {
    return writeJson(res, 200, { data: [{ id: 'sandbox-account', name: 'Sandbox Account' }] });
  }
  if (req.method === 'GET' && url.pathname === '/facebook/v25.0/me/accounts') {
    return writeJson(res, 200, { data: [{ id: 'sandbox-page', name: 'Sandbox Page' }] });
  }
  return writeJson(res, 404, { error: 'not found' });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Provider sandbox listening on ${port}`);
});

process.once('SIGTERM', () => server.close());
process.once('SIGINT', () => server.close());
