import { describe, expect, it, jest } from '@jest/globals';
import { IdentityApiException } from '../core/exceptions.js';
import { IdentityOwoxClient } from './IdentityOwoxClient.js';

describe('IdentityOwoxClient error redaction', () => {
  it('does not expose credentials from request or upstream response data', async () => {
    const client = new IdentityOwoxClient({
      clientBaseUrl: 'https://identity.example.test',
      clientTimeout: 1000,
      clientBackchannelPrefix: '/internal',
    });
    const token = 'access_token-secret-marker';
    const httpError = Object.assign(new Error('upstream failure'), {
      isAxiosError: true,
      response: {
        status: 400,
        data: {
          status: 'UnknownUser',
          access_token: token,
          params: { authorization_code: token, client_secret: token },
        },
      },
    });
    (client as unknown as { http: { post: jest.Mock } }).http.post = jest
      .fn()
      .mockRejectedValue(httpError);

    try {
      await client.getToken({
        grantType: 'authorization_code',
        authCode: token,
        clientId: 'client',
      });
      throw new Error('expected getToken to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(IdentityApiException);
      const exception = error as IdentityApiException;
      const serialized = JSON.stringify({ message: exception.message, context: exception.context });
      expect(serialized).not.toContain(token);
      expect(exception.context?.upstreamCode).toBe('UnknownUser');
    }
  });
});
