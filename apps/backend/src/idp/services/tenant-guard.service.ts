import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { AUTH_CONTEXT } from '../guards/idp.guard';
import { recordOperationalMetric } from '../../common/observability/operational-metric';

interface CachedAuthContext {
  projectId?: string;
}

/**
 * Defense-in-depth tenant boundary check.
 *
 * Use-cases that act on tenant-owned data must call `assertProject(projectId)`
 * with the project id derived from the request. The check compares it against
 * the authenticated project id stored in CLS by `IdpGuard`, so even if a
 * controller forgets to source the project id from the auth context (or a new
 * entry point is added in the future), the use-case still refuses to operate
 * on a different tenant.
 *
 * The check is a no-op when no CLS auth context is present — that path covers
 * background workers (queue processors, scheduled jobs) which legitimately
 * operate across projects without an HTTP request.
 */
@Injectable()
export class TenantGuardService {
  private readonly logger = new Logger(TenantGuardService.name);

  constructor(private readonly cls: ClsService) {}

  assertProject(projectId: string): void {
    if (!this.cls.isActive()) return;

    const authContext = this.cls.get<CachedAuthContext>(AUTH_CONTEXT);
    if (!authContext || !authContext.projectId) return;

    if (authContext.projectId !== projectId) {
      recordOperationalMetric(this.logger, 'tenant_boundary', 'mismatch');
      throw new ForbiddenException('Project mismatch');
    }
  }

  /**
   * Fail-closed variant for HTTP use-cases. Background jobs must use the
   * intentionally permissive `assertProject` path and provide their own job
   * scope; an HTTP request must never silently lose its tenant context.
   */
  assertHttpProject(projectId: string): void {
    if (!this.cls.isActive()) {
      recordOperationalMetric(this.logger, 'tenant_boundary', 'missing_context');
      throw new ForbiddenException('Tenant context is required');
    }

    const authContext = this.cls.get<CachedAuthContext>(AUTH_CONTEXT);
    if (!authContext?.projectId) {
      recordOperationalMetric(this.logger, 'tenant_boundary', 'missing_context');
      throw new ForbiddenException('Tenant context is required');
    }

    this.assertProject(projectId);
  }
}
