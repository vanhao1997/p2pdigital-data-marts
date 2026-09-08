/**
 * Better Auth session data
 */
export interface AuthSession {
  user: {
    id: string;
    email: string;
    name?: string;
    avatar?: string;
  };
  session: {
    id: string;
    userId: string;
    token: string;
    expiresAt: Date;
    activeOrganizationId?: string;
  };
}

/**
 * Session validation result
 */
export interface SessionValidationResult {
  isValid: boolean;
  session?: AuthSession;
  error?: string;
}
