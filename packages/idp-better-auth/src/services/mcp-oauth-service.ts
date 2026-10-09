import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import {
  AuthenticationError,
  McpOAuthProjectMemberContextSchema,
  McpTokenPayloadSchema,
  OAuthAuthorizationRequestSchema,
  OAuthTokenExchangeRequestSchema,
  type McpOAuthProjectMemberContext,
  type McpScope,
  type McpTokenPayload,
  type OAuthAuthorizationCode,
  type OAuthAuthorizationRequest,
  type OAuthTokenExchangeRequest,
  type OAuthTokenExchangeResult,
  type Role,
} from '@owox/idp-protocol';
import type { createBetterAuthConfig } from '../auth/auth-config.js';

const CODE_TTL_SECONDS = 300;
const ACCESS_TTL_SECONDS = 900;
const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;
const ROLE_RANK: Record<Role, number> = { viewer: 1, editor: 2, admin: 3 };
const grantSchema = McpTokenPayloadSchema.extend({ refreshExpiresAt: z.string().datetime() });
const codeSchema = grantSchema.extend({
  redirectUri: z.string().url(),
  codeChallenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});
type Grant = z.infer<typeof grantSchema>;
type ResolveMember = (
  context: McpOAuthProjectMemberContext
) => Promise<McpOAuthProjectMemberContext | null>;

/** Persisted opaque grants use Better Auth's existing atomic verification store. */
export class McpOAuthService {
  constructor(
    private readonly auth: Awaited<ReturnType<typeof createBetterAuthConfig>>,
    private readonly resolveMember: ResolveMember
  ) {}

  async createAuthorizationCode(
    input: OAuthAuthorizationRequest,
    member: McpOAuthProjectMemberContext
  ): Promise<OAuthAuthorizationCode> {
    const parsed = OAuthAuthorizationRequestSchema.safeParse(input);
    const context = McpOAuthProjectMemberContextSchema.safeParse(member);
    if (
      !parsed.success ||
      !context.success ||
      !/^[A-Za-z0-9_-]{43}$/.test(parsed.data.codeChallenge)
    ) {
      throw this.invalidGrant();
    }
    const request = parsed.data;
    const grant: Grant = {
      ...context.data,
      clientId: request.clientId,
      resource: request.resource,
      scopes: [...new Set(request.scopes)],
      authFlow: 'mcp',
      refreshExpiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000).toISOString(),
    };
    const activeGrant = await this.refreshAuthority(grant);
    if (!activeGrant) throw this.invalidGrant();
    const expiresAt = new Date(Date.now() + CODE_TTL_SECONDS * 1000);
    const code = await this.save(
      'code',
      {
        ...activeGrant,
        redirectUri: request.redirectUri,
        codeChallenge: request.codeChallenge,
      },
      expiresAt
    );
    return {
      code,
      clientId: request.clientId,
      redirectUri: request.redirectUri,
      resource: request.resource,
      scopes: activeGrant.scopes,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async exchangeToken(input: OAuthTokenExchangeRequest): Promise<OAuthTokenExchangeResult> {
    const parsed = OAuthTokenExchangeRequestSchema.safeParse(input);
    if (!parsed.success) throw this.invalidGrant();
    const request = parsed.data;
    const kind = request.grantType === 'authorization_code' ? 'code' : 'refresh';
    const token = kind === 'code' ? request.code : request.refreshToken;
    if (!token || !this.isToken(token, kind)) throw this.invalidGrant();
    const store = (await this.auth.$context).internalAdapter;
    // Issuing new tokens is gated by atomic consumption, including concurrent exchanges.
    const row = await store.consumeVerificationValue(this.identifier(token));
    if (!row || new Date(row.expiresAt).getTime() <= Date.now()) throw this.invalidGrant();
    const grant = this.parseGrant(row.value, kind === 'code' ? codeSchema : grantSchema);
    if (!grant || grant.clientId !== request.clientId || grant.resource !== request.resource)
      throw this.invalidGrant();
    if (kind === 'code') {
      const code = codeSchema.parse(grant);
      if (
        code.redirectUri !== request.redirectUri ||
        !request.codeVerifier ||
        !/^[A-Za-z0-9._~-]{43,128}$/.test(request.codeVerifier)
      )
        throw this.invalidGrant();
      const challenge = createHash('sha256').update(request.codeVerifier).digest('base64url');
      if (!timingSafeEqual(Buffer.from(challenge), Buffer.from(code.codeChallenge))) {
        throw this.invalidGrant();
      }
    }
    const current = await this.refreshAuthority(grant);
    if (!current) throw this.invalidGrant();
    return this.issueTokens(current);
  }

  async verifyAccessToken(
    token: string,
    resource: string,
    requiredScopes: McpScope[]
  ): Promise<McpTokenPayload | null> {
    if (!this.isToken(token, 'access')) return null;
    try {
      const store = (await this.auth.$context).internalAdapter;
      const row = await store.findVerificationValue(this.identifier(token));
      if (!row || new Date(row.expiresAt).getTime() <= Date.now()) return null;
      const grant = this.parseGrant(row.value, grantSchema);
      if (!grant || grant.resource !== resource) return null;
      if (!requiredScopes.every(scope => grant.scopes.includes(scope))) return null;
      const current = await this.refreshAuthority(grant);
      return current ? McpTokenPayloadSchema.parse(current) : null;
    } catch {
      return null;
    }
  }

  async revoke(token: string): Promise<void> {
    if (!['code', 'access', 'refresh'].some(kind => this.isToken(token, kind))) return;
    const store = (await this.auth.$context).internalAdapter;
    await store.deleteVerificationByIdentifier(this.identifier(token));
  }

  private async issueTokens(grant: Grant): Promise<OAuthTokenExchangeResult> {
    const refreshDeadline = new Date(grant.refreshExpiresAt);
    const expiresIn = Math.min(
      ACCESS_TTL_SECONDS,
      Math.floor((refreshDeadline.getTime() - Date.now()) / 1000)
    );
    if (expiresIn <= 0) throw this.invalidGrant();
    const accessToken = await this.save('access', grant, new Date(Date.now() + expiresIn * 1000));
    try {
      const refreshToken = await this.save('refresh', grant, refreshDeadline);
      return {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        expires_in: expiresIn,
        scope: grant.scopes.join(' '),
      };
    } catch {
      await this.revoke(accessToken);
      throw this.invalidGrant();
    }
  }

  private async refreshAuthority(grant: Grant): Promise<Grant | null> {
    if (Date.parse(grant.refreshExpiresAt) <= Date.now()) return null;
    const current = await this.resolveMember(grant);
    if (!current || current.userId !== grant.userId || current.projectId !== grant.projectId) {
      return null;
    }
    const originalRank = Math.max(...grant.roles.map(role => ROLE_RANK[role]));
    const currentRank = Math.max(...current.roles.map(role => ROLE_RANK[role]));
    const rank = Math.min(originalRank, currentRank);
    const role = (Object.keys(ROLE_RANK) as Role[]).find(
      candidate => ROLE_RANK[candidate] === rank
    );
    if (!role) return null;
    return {
      ...grant,
      ...current,
      roles: [role],
      scopes: [...grant.scopes],
    };
  }

  private parseGrant<T extends Grant>(
    value: string,
    schema: z.ZodType<T, z.ZodTypeDef, unknown>
  ): T | null {
    try {
      const parsed = schema.safeParse(JSON.parse(value));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  private async save<T extends Grant>(kind: string, value: T, expiresAt: Date): Promise<string> {
    const token = `mcp_${kind}_${randomBytes(32).toString('base64url')}`;
    const store = (await this.auth.$context).internalAdapter;
    await store.createVerificationValue({
      identifier: this.identifier(token),
      value: JSON.stringify(value),
      expiresAt,
    });
    return token;
  }

  private identifier(token: string): string {
    return `mcp-grant:${createHash('sha256').update(token).digest('hex')}`;
  }

  private isToken(token: string, kind: string): boolean {
    return new RegExp(`^mcp_${kind}_[A-Za-z0-9_-]{43}$`).test(token);
  }

  private invalidGrant(): AuthenticationError {
    return new AuthenticationError('Invalid or expired MCP OAuth grant');
  }
}
