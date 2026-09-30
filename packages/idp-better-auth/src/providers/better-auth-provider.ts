import {
  AuthResult,
  AddUserCommandResponse,
  IdpProviderAddUserCommand,
  IdpProviderListUsersCommand,
  IdpProviderRemoveUserCommand,
  IdpProvider,
  Payload,
  Project,
  Projects,
  ProjectMember,
  ProjectMemberInvitation,
  ProjectMembershipRequest,
  ApproveMembershipRequestResult,
  GetProjectMembersOptions,
  AuthenticationError,
  AuthorizationError,
  IdpOperationNotSupportedError,
  McpOAuthProjectMemberContext,
  McpScope,
  McpTokenPayload,
  OAuthAuthorizationCode,
  OAuthAuthorizationRequest,
  OAuthJwksResult,
  OAuthTokenExchangeRequest,
  OAuthTokenExchangeResult,
  Role,
  UserProvisioningSettings,
  UserProvisioningSettingsUpdate,
  UserProvisioningRequestAccessContext,
  RequestProjectAccessResult,
  CreateNewProjectResult,
  ProjectManagementProvider,
} from '@owox/idp-protocol';
import { randomUUID } from 'node:crypto';
import { Express, type Request, Response, NextFunction } from 'express';
import express from 'express';
import { BetterAuthConfig } from '../types/index.js';
import { createBetterAuthConfig } from '../auth/auth-config.js';
import { MagicLinkService } from '../services/magic-link-service.js';
import { CryptoService } from '../services/crypto-service.js';
import { AuthenticationService } from '../services/authentication-service.js';
import { TokenService } from '../services/token-service.js';
import { UserManagementService } from '../services/user-management-service.js';
import { RequestHandlerService } from '../services/request-handler-service.js';
import { MiddlewareService } from '../services/middleware-service.js';
import { PageService } from '../services/page-service.js';
import type { DatabaseStore } from '../store/DatabaseStore.js';
import { createDatabaseStore } from '../store/DatabaseStoreFactory.js';
import { logger } from '../logger.js';
import { getMigrations } from 'better-auth/db/migration';

const ROLE_RANK: Record<Role, number> = { viewer: 1, editor: 2, admin: 3 };

export class BetterAuthProvider
  implements
    IdpProvider,
    ProjectManagementProvider,
    IdpProviderAddUserCommand,
    IdpProviderListUsersCommand,
    IdpProviderRemoveUserCommand
{
  // Services
  private readonly authenticationService: AuthenticationService;
  private readonly tokenService: TokenService;
  private readonly userManagementService: UserManagementService;
  private readonly requestHandlerService: RequestHandlerService;
  private readonly middlewareService: MiddlewareService;
  private readonly pageService: PageService;

  private constructor(
    private readonly auth: Awaited<ReturnType<typeof createBetterAuthConfig>>,
    private readonly store: DatabaseStore,
    private readonly config: BetterAuthConfig
  ) {
    // Initialize core services
    const cryptoService = new CryptoService(this.auth);
    const magicLinkService = new MagicLinkService(this.auth, cryptoService);

    // Initialize UserManagementService first
    this.userManagementService = new UserManagementService(
      this.auth,
      magicLinkService,
      cryptoService,
      this.store
    );

    // Initialize all other business logic services
    this.authenticationService = new AuthenticationService(this.auth, cryptoService);
    this.tokenService = new TokenService(this.auth, cryptoService, this.userManagementService);
    this.requestHandlerService = new RequestHandlerService(this.auth);
    this.pageService = new PageService(
      this.authenticationService,
      this.userManagementService,
      cryptoService,
      config
    );
    this.middlewareService = new MiddlewareService(
      this.authenticationService,
      this.pageService,
      this.userManagementService
    );

    // Set circular dependency
    this.authenticationService.setUserManagementService(this.userManagementService);
  }

  static async create(config: BetterAuthConfig): Promise<BetterAuthProvider> {
    const store = createDatabaseStore(config.database);
    const adapter = await store.getAdapter();
    const auth = await createBetterAuthConfig(config, { adapter });
    return new BetterAuthProvider(auth, store, config);
  }

  registerRoutes(app: Express): void {
    // Setup middleware
    app.use('/auth', express.json()); // Add JSON parsing middleware
    app.use('/auth', express.urlencoded({ extended: true }));

    // Setup Better Auth handler
    this.requestHandlerService.setupBetterAuthHandler(app);
    this.pageService.registerRoutes(app);

    app.post(
      '/auth/api/sign-in',
      this.authenticationService.signInMiddleware.bind(this.authenticationService)
    );
    this.registerProjectManagementRoutes(app);
  }

  async signInMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void | Response> {
    return this.middlewareService.signInMiddleware(req, res, next);
  }

  async signUpMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void | Response> {
    // Trade-off: Currently redirects to sign-in flow as Better Auth doesn't have
    // a separate sign-up implementation yet. The product uses magic link authentication
    // where sign-up and sign-in are handled through the same flow.
    return this.middlewareService.signInMiddleware(req, res, next);
  }

  async signOutMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void | Response> {
    return this.middlewareService.signOutMiddleware(req, res, next);
  }

  async accessTokenMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void | Response> {
    return this.middlewareService.accessTokenMiddleware(req, res, next);
  }

  async userApiMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response<Payload>> {
    return this.middlewareService.userApiMiddleware(req, res, next);
  }

  async projectsApiMiddleware(
    req: Request,
    res: Response,
    _next: NextFunction
  ): Promise<Response<Projects>> {
    const authService = this.authenticationService as AuthenticationService & {
      getSession?: (request: Request) => Promise<{ user: { id: string } } | null>;
    };
    const session = await authService.getSession?.(req);
    const headerToken = req.headers?.['x-owox-authorization'];
    const token = Array.isArray(headerToken) ? headerToken[0] : headerToken;
    let tokenPayload: Payload | null = null;
    if (!session && token) {
      try {
        tokenPayload = await this.parseToken(token);
      } catch {
        // Preserve the existing unauthenticated response shape (an empty list).
      }
    }
    return res.json(await this.getProjectsForUser(session?.user.id ?? tokenPayload?.userId ?? ''));
  }

  async getProjects(accessToken: string): Promise<Projects> {
    const payload = await this.parseToken(accessToken);
    return this.getProjectsForUser(payload?.userId ?? '');
  }

  async getProjectForUser(userId: string, projectId: string): Promise<Project> {
    const organizationId = this.toOrganizationId(projectId);
    const roleValue =
      projectId === '0'
        ? await this.userManagementService.getUserRole(userId)
        : await this.userManagementService.getUserRole(userId, organizationId);
    const role = this.toRoleOrViewer(roleValue);
    const storeWithProjectMethods = this.store as Omit<DatabaseStore, 'getOrganization'> & {
      getOrganization?: DatabaseStore['getOrganization'];
    };
    const organization = storeWithProjectMethods.getOrganization
      ? await storeWithProjectMethods.getOrganization(organizationId)
      : null;
    if (storeWithProjectMethods.getOrganization && (!organization || !roleValue)) {
      return {
        id: projectId,
        title: organization?.name ?? projectId,
        status: 'blocked',
        roles: [],
      };
    }
    const metadata = this.parseMetadata(organization?.metadata);

    return {
      id: projectId,
      title: organization?.name ?? this.getProjectTitle(projectId),
      status: organization && metadata.archived ? 'blocked' : 'active',
      roles: [role],
      ...(organization ? { archived: metadata.archived, createdAt: organization.createdAt } : {}),
    };
  }

  async initialize(): Promise<void> {
    const { runMigrations } = await getMigrations(this.auth.options);
    await runMigrations();

    if (this.config.primaryAdminEmail) {
      await this.initializePrimaryAdmin(this.config.primaryAdminEmail);
    }
  }

  private async initializePrimaryAdmin(email: string): Promise<void> {
    try {
      const existingUser = await this.store.getUserByEmail(email);

      if (!existingUser) {
        logger.warn(`Primary admin not found. Creating admin user with email: ${email}`);
        await this.userManagementService.addUserViaMagicLink(email);

        const user = await this.store.getUserByEmail(email);
        if (user) {
          await this.userManagementService.ensureUserInDefaultOrganization(user.id, 'admin');
        }

        // Never put bearer magic-link URLs in logs. Deliver links only through
        // the explicit admin flow that returns them to an authenticated caller.
        logger.warn('Primary admin created; a magic link is ready for delivery', { email });
        return;
      }

      // Always ensure the primary admin is in the default organization
      await this.userManagementService.ensureUserInDefaultOrganization(existingUser.id, 'admin');

      const hasPassword = await this.store.userHasPassword(existingUser.id);

      if (!hasPassword) {
        logger.warn(
          `Primary admin exists but has no password. Generating new magic link with email: ${email}`
        );
        await this.userManagementService.addUserViaMagicLink(email);
        // The URL is a bearer credential and must not be persisted in logs.
        logger.warn('New magic link generated for primary admin', { email });
        return;
      }
    } catch (error) {
      logger.error('Failed to initialize primary admin', { email }, error as Error);
      throw error;
    }
  }

  async introspectToken(token: string): Promise<Payload | null> {
    return this.refreshIntrospectedPayload(await this.tokenService.introspectToken(token));
  }

  async parseToken(token: string): Promise<Payload | null> {
    return this.tokenService.parseToken(token);
  }

  async verifyToken(token: string): Promise<Payload | null> {
    return this.tokenService.introspectToken(token);
  }

  async refreshToken(refreshToken: string): Promise<AuthResult> {
    return this.tokenService.refreshToken(refreshToken);
  }

  async issueAccessTokenForProjectMemberApiKey(
    apiKeyId: string,
    userId: string,
    projectId: string,
    role: Role | null,
    readOnly: boolean
  ): Promise<AuthResult> {
    const user = await this.store.getUserById(userId);
    if (!user) {
      throw new AuthenticationError('Project member API key user not found');
    }

    const currentRole = this.toRoleOrNull(
      await this.userManagementService.getUserRole(userId, this.toOrganizationId(projectId))
    );
    if (!currentRole) {
      throw new AuthorizationError('Project member API key user is not an active project member');
    }

    const effectiveRole = role && ROLE_RANK[role] < ROLE_RANK[currentRole] ? role : currentRole;

    return this.tokenService.issueProjectMemberApiKeyAccessToken({
      userId,
      projectId,
      email: user.email,
      fullName: user.name || user.email,
      roles: [effectiveRole],
      viewOnly: readOnly,
      projectTitle: this.getProjectTitle(projectId),
      authFlow: 'api_key',
      apiKeyId,
    });
  }

  async issueAccessTokenForPluginRuntime(
    pluginId: string,
    installationId: string,
    userId: string,
    projectId: string
  ): Promise<AuthResult> {
    const user = await this.store.getUserById(userId);
    if (!user) {
      throw new AuthenticationError('Plugin runtime user not found');
    }

    const currentRole = this.toRoleOrNull(
      await this.userManagementService.getUserRole(userId, this.toOrganizationId(projectId))
    );
    if (!currentRole) {
      throw new AuthorizationError('Plugin runtime user is not an active project member');
    }

    return this.tokenService.issuePluginRuntimeAccessToken({
      userId,
      projectId,
      email: user.email,
      fullName: user.name || user.email,
      roles: [currentRole],
      projectTitle: this.getProjectTitle(projectId),
      authFlow: 'plugin',
      pluginId,
      installationId,
    });
  }

  async createMcpOAuthAuthorizationCode(
    _request: OAuthAuthorizationRequest,
    _projectMember: McpOAuthProjectMemberContext
  ): Promise<OAuthAuthorizationCode> {
    throw new IdpOperationNotSupportedError('createMcpOAuthAuthorizationCode');
  }

  async exchangeMcpOAuthToken(
    _request: OAuthTokenExchangeRequest
  ): Promise<OAuthTokenExchangeResult> {
    throw new IdpOperationNotSupportedError('exchangeMcpOAuthToken');
  }

  async verifyMcpAccessToken(
    _token: string,
    _resource: string,
    _requiredScopes: McpScope[]
  ): Promise<McpTokenPayload | null> {
    return null;
  }

  async getMcpOAuthJwks(): Promise<OAuthJwksResult> {
    throw new IdpOperationNotSupportedError('getMcpOAuthJwks');
  }

  async revokeToken(token: string): Promise<void> {
    return this.tokenService.revokeToken(token);
  }

  async shutdown(): Promise<void> {
    try {
      await this.store.shutdown();
    } catch (error) {
      logger.error('Failed to shutdown BetterAuthProvider store', {}, error as Error);
    }
  }

  async isHealthy(): Promise<boolean> {
    return await this.store.isHealthy();
  }

  /** Read project lifecycle state for scheduler workers without a user session. */
  async isOrganizationArchived(organizationId: string): Promise<boolean> {
    return this.userManagementService.isOrganizationArchived(organizationId);
  }

  async createProject(userId: string, title: string): Promise<Project> {
    const name = title.trim();
    if (!name || [...name].length > 100) {
      throw new Error('Project name must be 1-100 characters');
    }
    if ((await this.store.countOrganizationsForUser(userId)) >= 20) {
      throw new AuthorizationError('Project limit reached');
    }
    const id = randomUUID();
    await this.store.createOrganization(
      {
        id,
        name,
        slug: `owox-${id}`,
        metadata: JSON.stringify({ createdBy: userId, archived: false }),
        createdAt: new Date().toISOString(),
      },
      userId,
      'admin'
    );
    return this.getProjectForUser(userId, id);
  }

  async updateProject(userId: string, projectId: string, title: string): Promise<Project> {
    const organizationId = this.toOrganizationId(projectId);
    await this.assertAdminMember(organizationId, userId);
    await this.assertProjectWritable(organizationId);
    const name = title.trim();
    if (!name || [...name].length > 100) {
      throw new Error('Project name must be 1-100 characters');
    }
    const organization = await this.store.getOrganization(organizationId);
    if (!organization) throw new Error('Project not found');
    await this.store.updateOrganization(organizationId, name);
    return this.getProjectForUser(userId, projectId);
  }

  async archiveProject(userId: string, projectId: string): Promise<Project> {
    await this.assertProjectWritable(this.toOrganizationId(projectId));
    return this.setProjectArchived(userId, projectId, true);
  }

  async unarchiveProject(userId: string, projectId: string): Promise<Project> {
    return this.setProjectArchived(userId, projectId, false);
  }

  async selectProject(userId: string, projectId: string): Promise<void> {
    const organizationId = this.toOrganizationId(projectId);
    if (!(await this.store.getUserRole(organizationId, userId))) {
      throw new AuthorizationError('Project membership required');
    }
  }

  private async setProjectArchived(
    userId: string,
    projectId: string,
    archived: boolean
  ): Promise<Project> {
    const organizationId = this.toOrganizationId(projectId);
    await this.assertAdminMember(organizationId, userId);
    const organization = await this.store.getOrganization(organizationId);
    if (!organization) throw new Error('Project not found');
    const metadata = this.parseMetadata(organization.metadata);
    await this.store.updateOrganization(
      organizationId,
      organization.name,
      JSON.stringify({
        ...metadata,
        archived,
        ...(archived ? { archivedAt: new Date().toISOString() } : { archivedAt: undefined }),
      })
    );
    return this.getProjectForUser(userId, projectId);
  }

  async addUser(username: string, _password?: string): Promise<AddUserCommandResponse> {
    return this.userManagementService.addUserViaMagicLink(username);
  }

  async listUsers(): Promise<Payload[]> {
    return this.userManagementService.listUsers();
  }

  async removeUser(userId: string): Promise<void> {
    return this.userManagementService.removeUser(userId);
  }

  async getProjectMembers(
    projectId: string,
    _options?: GetProjectMembersOptions
  ): Promise<ProjectMember[]> {
    const members = this.store.listOrganizationMembers
      ? await this.store.listOrganizationMembers(this.toOrganizationId(projectId))
      : (await this.userManagementService.listUsers()).map(user => ({
          userId: user.userId,
          role: user.roles?.[0] ?? 'viewer',
          user: { email: user.email, name: user.fullName },
        }));
    return members.map(member => ({
      userId: member.userId,
      email: member.user?.email || '',
      fullName: member.user?.name,
      projectRole: this.toRoleOrViewer(member.role),
      userStatus: 'active',
      hasNotificationsEnabled: true, // No preference table yet
      isOutbound: false,
    }));
  }

  async inviteMember(
    projectId: string,
    email: string,
    role: Role,
    _actorUserId: string
  ): Promise<ProjectMemberInvitation> {
    const organizationId = this.toOrganizationId(projectId);
    await this.assertAdminMember(organizationId, _actorUserId);
    await this.assertProjectWritable(organizationId);
    const result = await this.userManagementService.inviteAndCreateStub(
      email,
      role,
      organizationId,
      _actorUserId
    );
    const { userId, magicLink } = result;
    return {
      projectId,
      email,
      role,
      kind: 'magic-link',
      magicLink,
      userId,
      ...(result.invitationId ? { invitationId: result.invitationId } : {}),
      ...(result.expiresAt ? { expiresAt: result.expiresAt } : {}),
    };
  }

  async removeMember(projectId: string, userId: string, actorUserId: string): Promise<void> {
    const organizationId = this.toOrganizationId(projectId);
    await this.assertAdminMember(organizationId, actorUserId);
    await this.assertProjectWritable(organizationId);
    if (userId === actorUserId)
      throw new AuthorizationError('You cannot remove yourself from the project');
    const targetRole = await this.store.getUserRole(organizationId, userId);
    if (!targetRole) throw new AuthorizationError('Project member not found');
    if (targetRole === 'admin') await this.assertNotLastAdmin(organizationId, userId);
    await this.store.removeUserFromOrganization(organizationId, userId);
  }

  async changeMemberRole(
    projectId: string,
    userId: string,
    newRole: Role,
    actorUserId: string
  ): Promise<void> {
    const organizationId = this.toOrganizationId(projectId);
    await this.assertAdminMember(organizationId, actorUserId);
    await this.assertProjectWritable(organizationId);
    const currentRole = await this.store.getUserRole(organizationId, userId);
    if (!currentRole) throw new AuthorizationError('Project member not found');
    if (currentRole === 'admin' && newRole !== 'admin') {
      await this.assertNotLastAdmin(organizationId, userId);
    }
    await this.store.addUserToOrganization(organizationId, userId, newRole);
  }

  async getUserProvisioningSettings(
    _projectId: string,
    _actorUserId: string
  ): Promise<UserProvisioningSettings> {
    return {
      isApplicable: false,
      organization: null,
      settings: null,
    };
  }

  async updateUserProvisioningSettings(
    _projectId: string,
    _actorUserId: string,
    _settings: UserProvisioningSettingsUpdate
  ): Promise<UserProvisioningSettings> {
    throw new IdpOperationNotSupportedError('updateUserProvisioningSettings');
  }

  async listMembershipRequests(
    _projectId: string,
    _actorUserId: string,
    _options?: { forceFresh?: boolean }
  ): Promise<ProjectMembershipRequest[]> {
    return [];
  }

  async approveMembershipRequest(
    _projectId: string,
    _requestId: string,
    _role: Role,
    _actorUserId: string
  ): Promise<ApproveMembershipRequestResult> {
    throw new IdpOperationNotSupportedError('approveMembershipRequest');
  }

  async declineMembershipRequest(
    _projectId: string,
    _requestId: string,
    _actorUserId: string
  ): Promise<void> {
    throw new IdpOperationNotSupportedError('declineMembershipRequest');
  }

  async getUserProvisioningRequestAccessContext(
    _userId: string,
    _projectId: string
  ): Promise<UserProvisioningRequestAccessContext> {
    throw new IdpOperationNotSupportedError('getUserProvisioningRequestAccessContext');
  }

  async requestProjectAccess(
    _userId: string,
    _projectId: string,
    _role: Role
  ): Promise<RequestProjectAccessResult> {
    throw new IdpOperationNotSupportedError('requestProjectAccess');
  }

  async createNewProject(_userId: string, _integration: string): Promise<CreateNewProjectResult> {
    throw new IdpOperationNotSupportedError('createNewProject');
  }

  async listPendingInvitations(
    projectId: string,
    actorUserId: string
  ): Promise<ProjectMemberInvitation[]> {
    const organizationId = this.toOrganizationId(projectId);
    const role = await this.userManagementService.getUserRole(actorUserId, organizationId);
    if (role !== 'admin') throw new AuthorizationError('Admin membership required');
    const invitations = await this.store.listInvitations(organizationId);
    return invitations
      .filter(invitation => invitation.status === 'pending')
      .map(invitation => ({
        projectId,
        email: invitation.email,
        role: invitation.role,
        kind: 'magic-link' as const,
        magicLink: '',
        invitationId: invitation.id,
        expiresAt: invitation.expiresAt,
      }));
  }

  async resendInvitation(
    projectId: string,
    invitationId: string,
    actorUserId: string
  ): Promise<ProjectMemberInvitation> {
    const organizationId = this.toOrganizationId(projectId);
    const role = await this.userManagementService.getUserRole(actorUserId, organizationId);
    if (role !== 'admin') throw new AuthorizationError('Admin membership required');
    await this.assertProjectWritable(organizationId);
    const invitation = await this.store.getInvitation(invitationId);
    if (
      !invitation ||
      invitation.organizationId !== organizationId ||
      invitation.status !== 'pending'
    )
      throw new Error('Invitation not found');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await this.store.updateInvitation(invitationId, { expiresAt });
    const magicLink = await this.userManagementService.generateMagicLinkForUser(
      invitation.email,
      invitation.role,
      projectId,
      invitationId
    );
    return {
      projectId,
      email: invitation.email,
      role: invitation.role,
      kind: 'magic-link',
      magicLink,
      invitationId,
      expiresAt,
    };
  }

  async cancelInvitation(
    projectId: string,
    invitationId: string,
    actorUserId: string
  ): Promise<void> {
    const organizationId = this.toOrganizationId(projectId);
    const role = await this.userManagementService.getUserRole(actorUserId, organizationId);
    if (role !== 'admin') throw new AuthorizationError('Admin membership required');
    await this.assertProjectWritable(organizationId);
    const invitation = await this.store.getInvitation(invitationId);
    if (!invitation || invitation.organizationId !== organizationId)
      throw new Error('Invitation not found');
    await this.store.updateInvitation(invitationId, { status: 'canceled' });
  }

  async isInvitationAccepted(
    invitationId: string,
    projectId: string,
    email: string
  ): Promise<boolean> {
    const invitation = await this.store.getInvitation(invitationId);
    return Boolean(
      invitation &&
      invitation.organizationId === this.toOrganizationId(projectId) &&
      invitation.status === 'accepted' &&
      invitation.email.trim().toLowerCase() === email.trim().toLowerCase()
    );
  }

  private toRoleOrViewer(role: string | null): Role {
    return role === 'admin' || role === 'editor' || role === 'viewer' ? role : 'viewer';
  }

  private async assertAdminMember(organizationId: string, userId: string): Promise<void> {
    // Resolve through the user-management boundary so legacy provider/test
    // doubles remain compatible while Better Auth stores still enforce the
    // organization-scoped membership lookup.
    const role = await this.userManagementService.getUserRole(userId, organizationId);
    if (role !== 'admin') {
      throw new AuthorizationError('Admin membership required');
    }
  }

  private async assertProjectWritable(organizationId: string): Promise<void> {
    if (await this.userManagementService.isOrganizationArchived(organizationId)) {
      throw new AuthorizationError('Project is archived and read-only');
    }
  }

  private async assertNotLastAdmin(organizationId: string, userId: string): Promise<void> {
    const members = await this.store.listOrganizationMembers(organizationId);
    const admins = members.filter(member => member.role === 'admin');
    if (admins.length <= 1 && admins.some(member => member.userId === userId)) {
      throw new AuthorizationError('Cannot remove or demote the last project admin');
    }
  }

  private toRoleOrNull(role: string | null): Role | null {
    return role === 'admin' || role === 'editor' || role === 'viewer' ? role : null;
  }

  private async refreshIntrospectedPayload(payload: Payload | null): Promise<Payload | null> {
    if (!payload) {
      return null;
    }

    const user = await this.store.getUserById(payload.userId);
    if (!user) {
      return null;
    }

    const currentRole = this.toRoleOrNull(
      await this.getUserRoleForProject(user.id, payload.projectId)
    );
    if ((payload.authFlow === 'api_key' || payload.authFlow === 'plugin') && !currentRole) {
      return null;
    }

    const projectTitle =
      (await this.userManagementService.getOrganizationTitle?.(
        this.toOrganizationId(payload.projectId)
      )) ?? this.getProjectTitle(payload.projectId);

    return {
      ...payload,
      email: user.email,
      fullName: user.name || user.email,
      roles: currentRole ? [currentRole] : undefined,
      projectTitle,
      ...((
        this.userManagementService.isOrganizationArchived
          ? await this.userManagementService.isOrganizationArchived(
              this.toOrganizationId(payload.projectId)
            )
          : false
      )
        ? { projectArchived: true, viewOnly: true }
        : {}),
    };
  }

  private getProjectTitle(projectId: string): string {
    return projectId === '0' ? 'P2PDigital Data Marts' : projectId;
  }

  private async getUserRoleForProject(userId: string, projectId: string): Promise<string | null> {
    return projectId === '0'
      ? this.userManagementService.getUserRole(userId)
      : this.userManagementService.getUserRole(userId, this.toOrganizationId(projectId));
  }

  private toOrganizationId(projectId: string): string {
    return projectId === '0' ? 'owox_data_marts_organization' : projectId;
  }

  private parseMetadata(metadata?: string | null): {
    archived?: boolean;
    archivedAt?: string;
    createdBy?: string;
  } {
    if (!metadata) return {};
    try {
      return JSON.parse(metadata) as {
        archived?: boolean;
        archivedAt?: string;
        createdBy?: string;
      };
    } catch {
      return {};
    }
  }

  private async getProjectsForUser(userId: string): Promise<Projects> {
    if (!userId) return [];
    const storeWithProjectMethods = this.store as Omit<
      DatabaseStore,
      'listOrganizationsForUser'
    > & { listOrganizationsForUser?: DatabaseStore['listOrganizationsForUser'] };
    if (!storeWithProjectMethods.listOrganizationsForUser) return [];
    const organizations = await storeWithProjectMethods.listOrganizationsForUser(userId);
    return Promise.all(
      organizations.map(async org => {
        const metadata = this.parseMetadata(org.metadata);
        const role = this.toRoleOrViewer(
          await this.userManagementService.getUserRole(userId, org.id)
        );
        return {
          id: org.id === 'owox_data_marts_organization' ? '0' : org.id,
          title: org.name,
          status: metadata.archived ? 'blocked' : 'active',
          archived: Boolean(metadata.archived),
          createdAt: org.createdAt,
          roles: role ? [role] : [],
        };
      })
    );
  }

  private registerProjectManagementRoutes(app: Express): void {
    const sessionHeaders = (req: Request) => req.headers as unknown as Headers;
    const requireSession = async (req: Request, res: Response) => {
      if (!this.isTrustedMutationOrigin(req)) {
        res.status(403).json({ error: 'Untrusted request origin' });
        return null;
      }
      const session = await this.authenticationService.getSession(req);
      if (!session) {
        res.status(401).json({ error: 'Unauthorized' });
        return null;
      }
      return session;
    };
    app.post('/auth/api/project-management/projects', async (req, res) => {
      const session = await requireSession(req, res);
      if (!session) return;
      try {
        const project = await this.createProject(
          session.user.id,
          typeof req.body?.name === 'string' ? req.body.name : ''
        );
        res.status(201).json(project);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to create project';
        res.status(message === 'Project limit reached' ? 409 : 400).json({ error: message });
      }
    });
    app.patch('/auth/api/project-management/projects/:projectId', async (req, res) => {
      const session = await requireSession(req, res);
      if (!session) return;
      try {
        const project = await this.updateProject(
          session.user.id,
          req.params.projectId,
          typeof req.body?.name === 'string' ? req.body.name : ''
        );
        res.json(project);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to rename project';
        res.status(message.includes('Admin') || message.includes('archived') ? 403 : 400).json({
          error: message,
        });
      }
    });
    for (const action of ['archive', 'unarchive'] as const) {
      app.post(`/auth/api/project-management/projects/:projectId/${action}`, async (req, res) => {
        const session = await requireSession(req, res);
        if (!session) return;
        const projectId = this.toOrganizationId(req.params.projectId);
        let project: Project;
        try {
          project =
            action === 'archive'
              ? await this.archiveProject(session.user.id, req.params.projectId)
              : await this.unarchiveProject(session.user.id, req.params.projectId);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unable to update project';
          res.status(message.includes('Admin') || message.includes('archived') ? 403 : 404).json({
            error: message,
          });
          return;
        }
        if (action === 'archive') {
          const activeOrganizationId =
            (session.session as { activeOrganizationId?: string }).activeOrganizationId ||
            'owox_data_marts_organization';
          if (activeOrganizationId === projectId) {
            const fallback = await this.userManagementService.resolveFirstActiveOrganizationId(
              session.user.id
            );
            if (fallback !== projectId) {
              const api = this.auth.api as unknown as {
                setActiveOrganization?: (input: unknown) => Promise<unknown>;
              };
              const result = await api.setActiveOrganization?.({
                headers: sessionHeaders(req),
                body: { organizationId: fallback },
                returnHeaders: true,
              });
              this.copyAuthResponseHeaders(res, result);
            }
          }
        }
        res.json(project);
      });
    }
    app.post('/auth/api/project-management/projects/:projectId/select', async (req, res) => {
      const session = await requireSession(req, res);
      if (!session) return;
      const projectId = this.toOrganizationId(req.params.projectId);
      try {
        await this.selectProject(session.user.id, req.params.projectId);
      } catch (error) {
        res.status(403).json({ error: error instanceof Error ? error.message : 'Forbidden' });
        return;
      }
      const api = this.auth.api as unknown as {
        setActiveOrganization?: (input: unknown) => Promise<unknown>;
      };
      if (!api.setActiveOrganization) {
        res.status(501).json({ error: 'Project selection unsupported' });
        return;
      }
      const result = await api.setActiveOrganization({
        headers: sessionHeaders(req),
        body: { organizationId: projectId },
        returnHeaders: true,
      });
      this.copyAuthResponseHeaders(res, result);
      res.json(await this.getProjectForUser(session.user.id, req.params.projectId));
    });
  }

  private isTrustedMutationOrigin(req: Request): boolean {
    const origin = req.get('origin');
    const referer = req.get('referer');
    const candidate =
      origin ||
      (referer
        ? (() => {
            try {
              return new URL(referer).origin;
            } catch {
              return null;
            }
          })()
        : null);
    if (!candidate) return false;
    const trusted = new Set(
      [this.config.baseURL, ...(this.config.trustedOrigins || [])]
        .filter(Boolean)
        .map(value => value!.replace(/\/$/, ''))
    );
    return trusted.has(candidate.replace(/\/$/, ''));
  }

  private copyAuthResponseHeaders(res: Response, result: unknown): void {
    const headers = (result as { headers?: Headers } | undefined)?.headers;
    if (!headers) return;
    const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
    if (typeof getSetCookie === 'function') {
      const cookies = getSetCookie.call(headers);
      if (cookies.length > 0) res.setHeader('set-cookie', cookies);
      return;
    }
    const cookie = headers.get('set-cookie');
    if (cookie) res.setHeader('set-cookie', cookie);
  }
}
