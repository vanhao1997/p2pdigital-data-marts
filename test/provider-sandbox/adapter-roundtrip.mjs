import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OauthCredentialsDto } from '../../packages/connectors/src/Core/Dto/OauthCredentialsDto.js';
import { loadGasClass } from '../../packages/connectors/test/support/loadGasClass.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const connectorsRoot = path.join(repoRoot, 'packages/connectors/src');
const baseUrl = process.env.PROVIDER_SANDBOX_URL || 'http://127.0.0.1:8099';
const mappedEndpoints = {
  googleToken: process.env.PROVIDER_SANDBOX_GOOGLE_TOKEN_URL || `${baseUrl}/google/oauth/token`,
  googleUserInfo:
    process.env.PROVIDER_SANDBOX_GOOGLE_USERINFO_URL || `${baseUrl}/google/userinfo`,
  facebookDebugToken:
    process.env.PROVIDER_SANDBOX_FACEBOOK_DEBUG_TOKEN_URL || `${baseUrl}/facebook/debug_token`,
  facebookGraphBase:
    process.env.PROVIDER_SANDBOX_FACEBOOK_GRAPH_BASE_URL || `${baseUrl}/facebook/v25.0`,
};

const nativeFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input));

  if (url.href === 'https://oauth2.googleapis.com/token') {
    return nativeFetch(mappedEndpoints.googleToken, init);
  }
  if (url.href === 'https://www.googleapis.com/oauth2/v2/userinfo') {
    return nativeFetch(mappedEndpoints.googleUserInfo, init);
  }
  if (url.hostname === 'graph.facebook.com' && url.pathname === '/debug_token') {
    return nativeFetch(`${mappedEndpoints.facebookDebugToken}${url.search}`, init);
  }
  if (url.hostname === 'graph.facebook.com' && url.pathname.startsWith('/v25.0/')) {
    return nativeFetch(`${mappedEndpoints.facebookGraphBase}${url.pathname.slice('/v25.0'.length)}${url.search}`, init);
  }

  return nativeFetch(input, init);
};

globalThis.CONFIG_ATTRIBUTES = {
  SECRET: 'SECRET',
  DEPRECATED: 'DEPRECATED',
  HIDE_IN_CONFIG_FORM: 'HIDE_IN_CONFIG_FORM',
  MANUAL_BACKFILL: 'MANUAL_BACKFILL',
  ADVANCED: 'ADVANCED',
  OAUTH_FLOW: 'OAUTH_FLOW',
  PINNED: 'PINNED',
  REQUIRED: 'REQUIRED',
};
globalThis.OAUTH_CONSTANTS = {
  UI: 'UI',
  SECRET: 'SECRET',
  REQUIRED: 'REQUIRED',
};
globalThis.OauthCredentialsDto = OauthCredentialsDto;

loadGasClass(path.join(connectorsRoot, 'Constants/HttpConstants.js'));
loadGasClass(path.join(connectorsRoot, 'Core/Exceptions.js'));
loadGasClass(path.join(connectorsRoot, 'Core/Utils/HttpUtils.js'));
loadGasClass(path.join(connectorsRoot, 'Core/Utils/OAuthUtils.js'));
loadGasClass(path.join(connectorsRoot, 'Core/AbstractSource.js'));
loadGasClass(path.join(connectorsRoot, 'Sources/GoogleAds/Source.js'));
loadGasClass(path.join(connectorsRoot, 'Sources/FacebookMarketing/Source.js'));

globalThis.GoogleAdsFieldsSchema = {};
globalThis.FacebookMarketingFieldsSchema = {};

await assertHealth();
await runGoogleRoundTrip();
await runFacebookRoundTrip();

console.log('Provider sandbox adapter round-trip passed');

function createConfig() {
  return {
    mergeParameters(parameters) {
      Object.assign(this, parameters);
      return this;
    },
    setParametersValues(values = {}) {
      for (const [key, value] of Object.entries(values)) {
        this[key] = key in this ? { ...this[key], value } : { value };
      }
      return this;
    },
    logMessage() {},
  };
}

function createGoogleSource() {
  const source = new globalThis.GoogleAdsSource(createConfig());
  source.config.MaxFetchRetries.value = 1;
  source.config.InitialRetryDelay.value = 1;
  return source;
}

function createFacebookSource() {
  const source = new globalThis.FacebookMarketingSource(createConfig());
  source.config.MaxFetchRetries.value = 1;
  source.config.InitialRetryDelay.value = 1;
  return source;
}

async function assertHealth() {
  const response = await nativeFetch(`${baseUrl}/healthz`);
  assert.equal(response.ok, true, 'provider sandbox health check failed');
}

async function runGoogleRoundTrip() {
  const source = createGoogleSource();
  const credentials = await source.exchangeOauthCredentials(
    { code: 'sandbox-code' },
    {
      ClientId: 'sandbox-client-id',
      ClientSecret: 'sandbox-client-secret',
      RedirectUri: 'http://localhost/sandbox/callback',
      DeveloperToken: 'sandbox-developer-token',
    }
  );

  assert.equal(credentials.secret.access_token, 'sandbox-google-access');
  assert.equal(credentials.secret.refresh_token, 'sandbox-google-refresh');
  assert.equal(credentials.user.id, 'sandbox-google-user');

  await assertRejectsWithMessage(
    source.exchangeOauthCredentials(
      { code: 'sandbox-denied' },
      {
        ClientId: 'sandbox-client-id',
        ClientSecret: 'sandbox-client-secret',
        RedirectUri: 'http://localhost/sandbox/callback',
        DeveloperToken: 'sandbox-developer-token',
      }
    ),
    'Token exchange failed',
    error => error.payload?.error === 'access_denied'
  );

  await assertRejectsWithMessage(
    source.exchangeOauthCredentials(
      { code: 'sandbox-expired' },
      {
        ClientId: 'sandbox-client-id',
        ClientSecret: 'sandbox-client-secret',
        RedirectUri: 'http://localhost/sandbox/callback',
        DeveloperToken: 'sandbox-developer-token',
      }
    ),
    'Token exchange failed',
    error => error.payload?.error === 'invalid_grant'
  );

  const expiredRefreshSource = createGoogleSource();
  expiredRefreshSource.config.AuthType = {
    value: 'oauth2',
    items: {
      ClientId: { value: 'sandbox-client-id' },
      ClientSecret: { value: 'sandbox-client-secret' },
      RefreshToken: { value: 'sandbox-expired' },
    },
  };

  await assertRejectsWithMessage(
    expiredRefreshSource.getAccessToken(),
    'invalid_grant',
    error => error.isWarning === true
  );
}

async function runFacebookRoundTrip() {
  const source = createFacebookSource();
  const credentials = await source.exchangeOauthCredentials(
    { accessToken: 'sandbox-facebook-token' },
    { AppId: 'sandbox-app-id', AppSecret: 'sandbox-app-secret' }
  );

  assert.equal(credentials.secret.accessToken, 'sandbox-facebook-access');
  assert.equal(credentials.user.id, 'sandbox-facebook-user');
  assert.equal(Array.isArray(credentials.additional.adAccounts.data), true);
  assert.equal(credentials.additional.adAccounts.data[0].id, 'sandbox-account');

  await assertRejectsWithMessage(
    source.exchangeOauthCredentials(
      { accessToken: 'sandbox-denied' },
      { AppId: 'sandbox-app-id', AppSecret: 'sandbox-app-secret' }
    ),
    'Invalid token',
    error => error.payload === 'Permissions denied'
  );

  await assertRejectsWithMessage(
    source.exchangeOauthCredentials(
      { accessToken: 'sandbox-expired' },
      { AppId: 'sandbox-app-id', AppSecret: 'sandbox-app-secret' }
    ),
    'Invalid token',
    error => error.payload === 'Session expired'
  );
}

async function assertRejectsWithMessage(promise, text, predicate = () => true) {
  try {
    await promise;
    throw new Error(`Expected failure containing "${text}"`);
  } catch (error) {
    const message = String(error?.message || error);
    if (!message.includes(text) || !predicate(error)) {
      throw new Error(`Unexpected failure: ${message}`);
    }
  }
}
