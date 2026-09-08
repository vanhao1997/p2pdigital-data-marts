const baseUrl = process.env.PROVIDER_SANDBOX_URL || 'http://127.0.0.1:8099';

async function json(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return response.json();
}

async function getJson(path, params) {
  const url = new URL(`${baseUrl}${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return response.json();
}

const health = await fetch(`${baseUrl}/healthz`);
if (!health.ok) throw new Error(`health returned ${health.status}`);

const google = await json('/google/oauth/token', { code: 'sandbox-code' });
if (!google.refresh_token || !google.access_token) throw new Error('Google fixture incomplete');

const facebook = await getJson('/facebook/debug_token', { input_token: 'sandbox-facebook-token' });
if (facebook.data?.is_valid !== true) throw new Error('Facebook fixture invalid');

const denied = await getJson('/facebook/debug_token', { input_token: 'sandbox-denied' });
if (denied.data?.error?.code !== 200) throw new Error('Facebook denial fixture invalid');

const expired = await getJson('/facebook/debug_token', { input_token: 'sandbox-expired' });
if (expired.data?.is_valid !== false) throw new Error('Facebook expiry fixture invalid');

console.log('Provider sandbox smoke passed');
