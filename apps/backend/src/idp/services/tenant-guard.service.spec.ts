import { ForbiddenException } from '@nestjs/common';
import type { ClsService } from 'nestjs-cls';
import { AUTH_CONTEXT } from '../guards/idp.guard';
import { TenantGuardService } from './tenant-guard.service';

describe('TenantGuardService', () => {
  const cls = {
    isActive: jest.fn(),
    get: jest.fn(),
  } as unknown as ClsService;
  let service: TenantGuardService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TenantGuardService(cls);
  });

  it('fails closed for an HTTP request without an active execution context', () => {
    (cls.isActive as jest.Mock).mockReturnValue(false);

    expect(() => service.assertHttpProject('project-1')).toThrow(
      new ForbiddenException('Tenant context is required')
    );
  });

  it('fails closed when an active HTTP context has no project', () => {
    (cls.isActive as jest.Mock).mockReturnValue(true);
    (cls.get as jest.Mock).mockReturnValue({ userId: 'user-1' });

    expect(() => service.assertHttpProject('project-1')).toThrow(
      new ForbiddenException('Tenant context is required')
    );
    expect(cls.get).toHaveBeenCalledWith(AUTH_CONTEXT);
  });

  it('rejects an HTTP request that crosses the authenticated project boundary', () => {
    (cls.isActive as jest.Mock).mockReturnValue(true);
    (cls.get as jest.Mock).mockReturnValue({ userId: 'user-1', projectId: 'project-1' });

    expect(() => service.assertHttpProject('project-2')).toThrow(
      new ForbiddenException('Project mismatch')
    );
  });

  it('allows an HTTP request whose project matches the authenticated context', () => {
    (cls.isActive as jest.Mock).mockReturnValue(true);
    (cls.get as jest.Mock).mockReturnValue({ userId: 'user-1', projectId: 'project-1' });

    expect(() => service.assertHttpProject('project-1')).not.toThrow();
  });

  it('keeps the background-worker assertProject path permissive without CLS', () => {
    (cls.isActive as jest.Mock).mockReturnValue(false);

    expect(() => service.assertProject('project-1')).not.toThrow();
  });
});
