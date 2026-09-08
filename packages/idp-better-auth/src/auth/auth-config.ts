import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { z } from 'zod';
import { magicLink, organization } from 'better-auth/plugins';
import { BetterAuthConfig } from '../types/index.js';
import { createAccessControl } from 'better-auth/plugins/access';
import { LoggerFactory, LogLevel } from '@owox/internal-helpers';
import { writeFileSync } from 'node:fs';

/**
 * Better Auth `before` hook handler: forces `revokeOtherSessions: true` onto the
 * `/change-password` request body so a password change always revokes the user's
 * other sessions (the acting session keeps a freshly issued token). Other paths
 * pass through unchanged. Extracted from the config for unit testing.
 */
export function forceRevokeOtherSessionsOnChangePassword(ctx: {
  path: string;
  body?: unknown;
}): { context: { body: Record<string, unknown> } } | undefined {
  if (ctx.path === '/change-password') {
    return {
      context: {
        body: { ...(ctx.body as Record<string, unknown> | undefined), revokeOtherSessions: true },
      },
    };
  }
  return undefined;
}

const avatarUpdateSchema = z.object({
  image: z
    .string()
    .max(2048)
    .url()
    .refine(value => {
      try {
        const url = new URL(value);
        return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
      } catch {
        return false;
      }
    })
    .nullable()
    .optional(),
});

export function validateAvatarUpdate(ctx: { path: string; body?: unknown }): void {
  if (ctx.path !== '/update-user') return undefined;
  if (!avatarUpdateSchema.safeParse(ctx.body ?? {}).success) {
    throw new APIError('BAD_REQUEST', { message: 'Invalid avatar URL' });
  }
}

async function beforeAuthHook(ctx: { path: string; body?: unknown }) {
  validateAvatarUpdate(ctx);
  return forceRevokeOtherSessionsOnChangePassword(ctx);
}

export async function createBetterAuthConfig(
  config: BetterAuthConfig,
  options?: { adapter?: unknown }
): Promise<ReturnType<typeof betterAuth>> {
  const logger = LoggerFactory.createNamedLogger('better-auth');
  const database = options?.adapter;

  const plugins: unknown[] = [];

  plugins.push(
    magicLink({
      sendMagicLink: async ({ email, token, url }) => {
        const testMagicLinkFile =
          process.env.NODE_ENV === 'test' && process.env.IDP_BETTER_AUTH_TEST_MAGIC_LINK_FILE;
        try {
          const original = new URL(url);
          const tokenParam = original.searchParams.get('token') || token;
          const callbackParam = original.searchParams.get('callbackURL') || '';
          const preConfirmPage = new URL(original.origin);
          preConfirmPage.pathname = '/auth/magic-link';
          preConfirmPage.searchParams.set('token', tokenParam);
          if (callbackParam) {
            preConfirmPage.searchParams.set('callbackURL', callbackParam);
          }

          (
            global as unknown as {
              lastMagicLink: string;
              lastEmail: string;
              lastToken: string;
            }
          ).lastMagicLink = preConfirmPage.toString();
        } catch {
          (
            global as unknown as {
              lastMagicLink: string;
              lastEmail: string;
              lastToken: string;
            }
          ).lastMagicLink = url;
        }
        if (testMagicLinkFile) {
          writeFileSync(
            testMagicLinkFile,
            (global as unknown as { lastMagicLink: string }).lastMagicLink,
            {
              encoding: 'utf8',
            }
          );
        }
        (
          global as unknown as {
            lastMagicLink: string;
            lastEmail: string;
            lastToken: string;
          }
        ).lastEmail = email;
        (
          global as unknown as {
            lastMagicLink: string;
            lastEmail: string;
            lastToken: string;
          }
        ).lastToken = token;
      },
      expiresIn: config.magicLinkTtl,
      disableSignUp: false,
    })
  );

  const ac = createAccessControl({
    project: ['create', 'update', 'delete', 'view'],
  });

  const adminRole = ac.newRole({
    project: ['create', 'update', 'delete', 'view'],
  });

  const editorRole = ac.newRole({
    project: ['create', 'update', 'delete', 'view'],
  });

  const viewerRole = ac.newRole({
    project: ['view'],
  });

  plugins.push(
    organization({
      ac,
      roles: {
        admin: adminRole,
        editor: editorRole,
        viewer: viewerRole,
      },
      allowUserToCreateOrganization: true,
      organizationLimit: 50,
      creatorRole: 'admin',
      invitationExpiresIn: 60 * 60 * 24 * 7,
      async sendInvitationEmail(_data) {
        return;
      },
    })
  );

  const calcBaseURL = config.baseURL || `http://localhost:${process.env.PORT || '3000'}`;
  const authConfig: Record<string, unknown> = {
    database,
    plugins,
    session: {
      expiresIn: config.session?.maxAge || 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    trustedOrigins: [calcBaseURL, ...(config.trustedOrigins || [])],
    baseURL: calcBaseURL,
    secret: config.secret,
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    hooks: {
      // Security: the Better Auth `/change-password` endpoint is exposed through
      // the request handler. By default it only revokes other sessions when the
      // caller opts in via `revokeOtherSessions`. Force it on so a password
      // change always invalidates the user's other sessions while Better Auth
      // issues a fresh session for the current one. Logic extracted to
      // forceRevokeOtherSessionsOnChangePassword for unit testing.
      before: createAuthMiddleware(async ctx => beforeAuthHook(ctx)),
    },
    advanced: {
      cookies: {
        session_token: {
          name: 'refreshToken',
          attributes: {
            httpOnly: true,
            secure:
              config.baseURL?.includes('localhost') ||
              config.baseURL?.includes('127.0.0.1') ||
              !config.baseURL?.startsWith('https://')
                ? false
                : true,
          },
        },
      },
    },
    logger: {
      disabled: false,
      disableColors: true,
      level: 'error',
      log: (level: string, message: string, ...args: unknown[]) => {
        switch (level) {
          case 'error':
            logger.log(LogLevel.ERROR, message, { args });
            break;
          case 'warn':
            logger.log(LogLevel.WARN, message, { args });
            break;
          case 'info':
            logger.log(LogLevel.INFO, message, { args });
            break;
          case 'debug':
            logger.log(LogLevel.DEBUG, message, { args });
            break;
          default:
            logger.log(LogLevel.INFO, message, { args });
        }
      },
    },
    telemetry: { enabled: false },
    basePath: '/auth/better-auth',
  } as Record<string, unknown>;

  return betterAuth(authConfig);
}
