import { ConfigService } from '@nestjs/config';
import dns from 'node:dns/promises';
import { OAuthClientMetadataService } from './oauth-client-metadata.service';
import { OAuthConfigService } from './oauth-config.service';
import { OAuthRedirectUriPolicy } from './oauth-redirect-uri.policy';
import { OAuthRequestValidator } from './oauth-request.validator';
import { McpResourceResolverService } from '../../mcp-resource/mcp-resource-resolver.service';

jest.mock('node:dns/promises', () => ({
  __esModule: true,
  default: { resolve4: jest.fn(), resolve6: jest.fn() },
}));

const clientId = 'https://client.example/metadata/' + 'a'.repeat(150) + '.json';
const resource = 'https://mcp.owox.com/mcp';
const redirectUri = 'http://127.0.0.1:59943/callback/exact-path';

describe('OAuth CIMD boundary', () => {
  let fetchMock: jest.SpyInstance;
  let service: OAuthClientMetadataService;

  function createService(overrides: Record<string, unknown> = {}) {
    const configService = new ConfigService({
      MCP_PUBLIC_BASE_URL: 'https://mcp.owox.com',
      OWOX_AUTH_PUBLIC_BASE_URL: 'https://auth.example',
      MCP_CLIENT_METADATA_ALLOWED_ORIGINS: 'https://client.example',
      ...overrides,
    });
    const config = new OAuthConfigService(configService);
    const metadata = new OAuthClientMetadataService(config, new OAuthRedirectUriPolicy(config));
    const registry = { get: jest.fn() };
    return {
      metadata,
      registry,
      validator: new OAuthRequestValidator(
        config,
        registry as never,
        new McpResourceResolverService(configService),
        metadata
      ),
    };
  }

  function response(overrides: Record<string, unknown> = {}, headers: HeadersInit = {}) {
    return new Response(
      JSON.stringify({
        client_id: clientId,
        client_name: 'Test client',
        redirect_uris: [redirectUri],
        ...overrides,
      }),
      { headers: { 'Content-Type': 'application/json', ...headers } }
    );
  }

  beforeEach(() => {
    jest.mocked(dns.resolve4).mockResolvedValue(['93.184.216.34'] as never);
    jest.mocked(dns.resolve6).mockResolvedValue([] as never);
    fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(async () => response());
    service = createService().metadata;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('resolves a long URL identity and caches only validated client metadata', async () => {
    expect(clientId.length).toBeGreaterThan(100);
    const client = await service.resolve(clientId);
    expect(client).toMatchObject({
      clientId,
      redirectUris: [redirectUri],
      scopes: ['mcp:read', 'mcp:write'],
    });
    expect(client?.resource).toBeUndefined();
    expect(await service.resolve(clientId)).toBe(client);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      redirect: 'manual',
      signal: expect.any(AbortSignal),
    });
  });

  it.each([
    { token_endpoint_auth_methods_supported: ['none', 'private_key_jwt'] },
    {
      token_endpoint_auth_method: 'private_key_jwt',
      token_endpoint_auth_methods_supported: ['none', 'private_key_jwt'],
    },
    {
      token_endpoint_auth_method: 'private_key_jwt',
      token_endpoint_auth_methods_supported: ['private_key_jwt', 'none'],
    },
  ])('selects supported public-client authentication from capabilities %j', async metadata => {
    fetchMock.mockImplementation(async () => response(metadata));
    await expect(service.resolve(clientId)).resolves.toMatchObject({
      clientId,
      redirectUris: [redirectUri],
      scopes: ['mcp:read', 'mcp:write'],
    });
  });

  it('validates the published ChatGPT CIMD shape without weakening authorization checks', async () => {
    const chatGptClientId = 'https://chatgpt.com/oauth/client.json';
    const chatGptRedirectUri = 'https://chatgpt.com/connector_platform_oauth_redirect';
    const { validator } = createService({
      MCP_CLIENT_METADATA_ALLOWED_ORIGINS: 'https://chatgpt.com',
      MCP_DYNAMIC_CLIENT_ALLOWED_REDIRECT_ORIGINS: 'https://chatgpt.com',
    });
    fetchMock.mockImplementation(async () =>
      response({
        client_id: chatGptClientId,
        client_name: 'ChatGPT',
        redirect_uris: [chatGptRedirectUri],
        token_endpoint_auth_method: 'private_key_jwt',
        token_endpoint_auth_methods_supported: ['none', 'private_key_jwt'],
      })
    );
    const authorization = {
      response_type: 'code',
      client_id: chatGptClientId,
      redirect_uri: chatGptRedirectUri,
      resource,
      scope: 'mcp:read',
      state: 'state',
      code_challenge: 'challenge',
      code_challenge_method: 'S256',
    };
    await expect(validator.validateAuthorizationRequest(authorization)).resolves.toMatchObject({
      request: { clientId: chatGptClientId, redirectUri: chatGptRedirectUri, resource },
    });
    for (const invalid of [
      { code_challenge_method: 'plain' },
      { redirect_uri: 'https://chatgpt.com/other-callback' },
      { resource: 'https://other.example/mcp' },
      { scope: 'admin' },
    ]) {
      await expect(
        validator.validateAuthorizationRequest({ ...authorization, ...invalid })
      ).rejects.toThrow();
    }
  });

  it.each(['no-store', 'no-cache', 'max-age=0'])(
    'refetches documents with Cache-Control %s',
    async cacheControl => {
      fetchMock.mockImplementation(async () => response({}, { 'Cache-Control': cacheControl }));
      await service.resolve(clientId);
      await service.resolve(clientId);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    }
  );

  it('bounds max-age and refetches after expiry', async () => {
    jest.useFakeTimers();
    service = createService({ MCP_CLIENT_METADATA_CACHE_MAX_TTL_MS: 1000 }).metadata;
    fetchMock.mockImplementation(async () => response({}, { 'Cache-Control': 'max-age=86400' }));
    await service.resolve(clientId);
    await jest.advanceTimersByTimeAsync(1001);
    await service.resolve(clientId);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    'http://client.example/metadata.json',
    'https://client.example/',
    'https://user:password@client.example/metadata.json',
    'https://client.example/metadata.json#fragment',
    'https://unapproved.example/metadata.json',
  ])('rejects invalid or unapproved client URL %s before fetching', async url => {
    await expect(service.resolve(url)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a private DNS answer before connecting', async () => {
    jest.mocked(dns.resolve4).mockResolvedValue(['169.254.169.254'] as never);
    await expect(service.resolve(clientId)).rejects.toThrow('could not be fetched');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects cross-origin redirects before sending a second request', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { Location: 'https://evil.example/client.json' } })
    );
    await expect(service.resolve(clientId)).rejects.toThrow('could not be fetched');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('follows a guarded same-origin redirect and retains exact client identity', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { Location: '/latest.json' } })
    );
    await expect(service.resolve(clientId)).resolves.toMatchObject({ clientId });
    expect(fetchMock.mock.calls[1][0]).toBe('https://client.example/latest.json');
  });

  it.each([
    { client_id: 'https://client.example/other.json' },
    { redirect_uris: ['https://evil.example/callback'] },
    { grant_types: ['client_credentials'] },
    { response_types: [] },
    { token_endpoint_auth_method: 'client_secret_post' },
    { token_endpoint_auth_method: 'private_key_jwt' },
    { token_endpoint_auth_methods_supported: ['private_key_jwt'] },
    {
      token_endpoint_auth_method: 'none',
      token_endpoint_auth_methods_supported: ['private_key_jwt'],
    },
    { token_endpoint_auth_methods_supported: [] },
    { token_endpoint_auth_methods_supported: [''] },
    { token_endpoint_auth_methods_supported: 'none' },
    { scope: 'admin' },
    { scope: '' },
  ])('rejects invalid metadata %j', async invalid => {
    fetchMock.mockImplementation(async () => response(invalid));
    await expect(service.resolve(clientId)).rejects.toThrow();
  });

  it('bounds a stalled fetch', async () => {
    jest.useFakeTimers();
    fetchMock.mockImplementation(() => new Promise(() => undefined));
    const pending = expect(service.resolve(clientId)).rejects.toThrow('could not be fetched');
    await jest.advanceTimersByTimeAsync(5001);
    await pending;
  });

  it('rejects oversized documents without retaining them', async () => {
    fetchMock.mockImplementation(
      async () =>
        new Response('x'.repeat(65537), {
          headers: { 'Content-Type': 'application/json' },
        })
    );
    await expect(service.resolve(clientId)).rejects.toThrow('too large');
  });

  it('keeps resource, scopes, PKCE and exact redirects at the authorization boundary', async () => {
    const { validator, registry } = createService();
    const authorization = {
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      resource,
      scope: 'mcp:read',
      state: 'state',
      code_challenge: 'challenge',
      code_challenge_method: 'S256',
    };
    await expect(validator.validateAuthorizationRequest(authorization)).resolves.toMatchObject({
      request: { clientId, resource, redirectUri },
    });
    expect(registry.get).not.toHaveBeenCalled();
    for (const invalid of [
      { resource: undefined },
      { resource: 'https://evil.example/mcp' },
      { redirect_uri: 'http://127.0.0.1:59944/callback/exact-path' },
      { scope: 'admin' },
      { code_challenge_method: 'plain' },
    ]) {
      await expect(
        validator.validateAuthorizationRequest({ ...authorization, ...invalid })
      ).rejects.toThrow();
    }
    await expect(
      validator.validateTokenRequest(
        {
          grant_type: 'refresh_token',
          client_id: clientId,
          refresh_token: 'test-refresh',
          resource,
        },
        resource
      )
    ).resolves.toMatchObject({ request: { clientId, resource, grantType: 'refresh_token' } });
    await expect(
      validator.validateTokenRequest(
        {
          grant_type: 'refresh_token',
          client_id: clientId,
          refresh_token: 'test-refresh',
          resource,
        },
        'https://other.example/mcp'
      )
    ).rejects.toThrow('request resource');
  });
});
