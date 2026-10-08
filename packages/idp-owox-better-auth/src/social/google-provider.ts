import { createServiceLogger } from '../core/logger.js';
import { Profile, SocialProvider, SocialUser } from './social-provider.js';

export type GoogleProviderOptions = {
  clientId?: string;
  clientSecret?: string;
  redirectURI?: string;
  prompt?: string;
  accessType?: string;
};

/**
 * Maps Google OAuth profile data into the app user format.
 */
export class GoogleProvider implements SocialProvider {
  public providerId = 'google';
  private readonly logger = createServiceLogger(GoogleProvider.name);

  constructor(private readonly opts: GoogleProviderOptions) {
    this.validate();
  }

  private validate() {
    const missing = ['clientId', 'clientSecret'].filter(
      key => !(this.opts as Record<string, string | undefined>)[key]
    );
    if (missing.length) {
      throw new Error(`[google] Missing required secrets: ${missing.join(', ')}`);
    }
  }

  private selectAccountId(profile: Profile): string {
    const p = profile as { sub?: string };
    return p.sub ? String(p.sub) : '';
  }

  buildConfig() {
    return {
      clientId: this.opts.clientId,
      clientSecret: this.opts.clientSecret,
      redirectURI: this.opts.redirectURI,
      prompt: this.opts.prompt ?? 'select_account',
      accessType: this.opts.accessType ?? 'offline',
      mapProfileToUser: (profile: Record<string, unknown>) => {
        const mapped = this.mapProfile(profile);
        const { accountId, ...user } = mapped;
        return { ...user, id: accountId };
      },
    };
  }

  mapProfile(profile: Profile): SocialUser {
    const p = profile as {
      sub?: string;
      email?: string;
      name?: string;
      given_name?: string;
      picture?: string;
      email_verified?: boolean;
    };
    this.logger.info(`${this.providerId}-profile`, summarizeGoogleProfileForLog(profile));

    const accountId = this.selectAccountId(p);
    if (!accountId) {
      throw new Error('[google] Unable to resolve accountId (sub is missing)');
    }

    const email = p.email ?? null;
    if (!email) {
      throw new Error('[google] Email is required in profile');
    }

    return {
      accountId,
      email,
      name: p.name ?? p.given_name ?? null,
      image: p.picture ?? null,
      emailVerified: Boolean(p.email_verified),
    };
  }
}

export function summarizeGoogleProfileForLog(profile: Profile): Record<string, unknown> {
  const p = profile as {
    sub?: unknown;
    email?: unknown;
    name?: unknown;
    given_name?: unknown;
    picture?: unknown;
    email_verified?: unknown;
  };

  return {
    profile: {
      hasAccountId: typeof p.sub === 'string' && p.sub.length > 0,
      hasEmail: typeof p.email === 'string' && p.email.length > 0,
      hasName: typeof p.name === 'string' && p.name.length > 0,
      hasGivenName: typeof p.given_name === 'string' && p.given_name.length > 0,
      hasImage: typeof p.picture === 'string' && p.picture.length > 0,
      emailVerified: typeof p.email_verified === 'boolean' ? p.email_verified : undefined,
    },
  };
}
