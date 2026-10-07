import { createServiceLogger } from '../core/logger.js';
import { Profile, SocialProvider, SocialUser } from './social-provider.js';

export type MicrosoftProviderOptions = {
  clientId?: string;
  clientSecret?: string;
  redirectURI?: string;
  tenantId?: string;
  authority?: string;
  prompt?: string;
};

/**
 * Maps Microsoft Entra ID profile data into the app user format.
 */
export class MicrosoftProvider implements SocialProvider {
  public providerId = 'microsoft';
  private readonly logger = createServiceLogger(MicrosoftProvider.name);

  constructor(private readonly opts: MicrosoftProviderOptions) {
    this.validate();
  }

  private validate() {
    const missing = ['clientId', 'clientSecret'].filter(
      key => !(this.opts as Record<string, string | undefined>)[key]
    );
    if (missing.length) {
      throw new Error(`[microsoft] Missing required secrets: ${missing.join(', ')}`);
    }
  }

  private selectAccountId(profile: Profile): string {
    const p = profile as { oid?: string; tid?: string };
    if (p.oid && p.tid) return `${p.oid}:${p.tid}`;
    return '';
  }

  buildConfig() {
    return {
      clientId: this.opts.clientId,
      clientSecret: this.opts.clientSecret,
      redirectURI: this.opts.redirectURI,
      tenantId: this.opts.tenantId ?? 'common',
      authority: this.opts.authority ?? 'https://login.microsoftonline.com',
      prompt: this.opts.prompt ?? 'select_account',
      mapProfileToUser: (profile: Record<string, unknown>) => {
        const mapped = this.mapProfile(profile);
        const { accountId, ...user } = mapped;
        return { ...user, id: accountId };
      },
    };
  }

  mapProfile(profile: Profile): SocialUser {
    const p = profile as {
      oid?: string;
      tid?: string;
      email?: string;
      preferred_username?: string;
      name?: string;
    };
    this.logger.info(`${this.providerId}-profile`, summarizeMicrosoftProfileForLog(profile));

    const accountId = this.selectAccountId(p);
    if (!accountId) {
      throw new Error('[microsoft] Unable to resolve accountId (oid/tid are missing)');
    }

    const email = p.email ?? p.preferred_username ?? null;
    if (!email) {
      throw new Error('[microsoft] Email is required in profile');
    }

    return {
      accountId,
      email,
      name: p.name ?? null,
      image: null,
      emailVerified: true,
    };
  }
}

export function summarizeMicrosoftProfileForLog(profile: Profile): Record<string, unknown> {
  const p = profile as {
    oid?: unknown;
    tid?: unknown;
    email?: unknown;
    preferred_username?: unknown;
    name?: unknown;
  };

  return {
    profile: {
      hasObjectId: typeof p.oid === 'string' && p.oid.length > 0,
      hasTenantId: typeof p.tid === 'string' && p.tid.length > 0,
      hasEmail: typeof p.email === 'string' && p.email.length > 0,
      hasPreferredUsername:
        typeof p.preferred_username === 'string' && p.preferred_username.length > 0,
      hasName: typeof p.name === 'string' && p.name.length > 0,
    },
  };
}
