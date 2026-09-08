import { type Request, type Response, type NextFunction } from 'express';
import { Payload } from '@owox/idp-protocol';
import { AuthenticationService } from './authentication-service.js';
import { PageService } from './page-service.js';
import { UserManagementService } from './user-management-service.js';
import { logger } from '../logger.js';

export class MiddlewareService {
  private static readonly DEFAULT_ORGANIZATION_ID = 'owox_data_marts_organization';

  constructor(
    private readonly authenticationService: AuthenticationService,
    private readonly pageService: PageService,
    private readonly userManagementService: UserManagementService
  ) {}

  async signInMiddleware(
    req: Request,
    res: Response,
    _next: NextFunction
  ): Promise<void | Response> {
    return this.pageService.signInPage.bind(this.pageService)(req, res);
  }

  async signOutMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void | Response> {
    return this.authenticationService.signOutMiddleware(req, res, next);
  }

  async accessTokenMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void | Response> {
    return this.authenticationService.accessTokenMiddleware(req, res, next);
  }

  async userApiMiddleware(
    req: Request,
    res: Response,
    _next: NextFunction
  ): Promise<Response<Payload>> {
    try {
      const validation = await this.authenticationService.validateSession(req);

      if (!validation.isValid || !validation.session) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const organizationId = this.userManagementService.resolveActiveOrganizationId
        ? await this.userManagementService.resolveActiveOrganizationId(
            validation.session.user.id,
            validation.session.session.activeOrganizationId
          )
        : validation.session.session.activeOrganizationId ||
          MiddlewareService.DEFAULT_ORGANIZATION_ID;
      const role = organizationId
        ? await this.userManagementService.getUserRole(validation.session.user.id, organizationId)
        : null;
      const service = this.userManagementService as UserManagementService & {
        isOrganizationArchived?: (id: string) => Promise<boolean>;
        getOrganizationTitle?: (id: string) => Promise<string | null>;
      };
      const projectArchived = organizationId
        ? (await service.isOrganizationArchived?.(organizationId)) === true
        : false;
      const projectTitle = organizationId
        ? ((await service.getOrganizationTitle?.(organizationId)) ?? null)
        : null;

      const payload: Payload = {
        userId: validation.session.user.id,
        projectId:
          role && organizationId
            ? organizationId === MiddlewareService.DEFAULT_ORGANIZATION_ID
              ? '0'
              : organizationId
            : '',
        email: validation.session.user.email,
        fullName: validation.session.user.name || validation.session.user.email,
        ...(validation.session.user.avatar ? { avatar: validation.session.user.avatar } : {}),
        roles: role ? [role as 'admin' | 'editor' | 'viewer'] : [],
        ...(projectTitle ? { projectTitle } : {}),
        ...(projectArchived ? { projectArchived: true, viewOnly: true } : {}),
      };

      return res.json(payload);
    } catch (error) {
      logger.error('User API middleware error', {}, error as Error);
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }
}
