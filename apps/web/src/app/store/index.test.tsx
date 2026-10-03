import type { ReactNode } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthStatus, type User } from '../../features/idp/types';
import { RequestStatus } from '../../shared/types/request-status';
import { checkVisible } from '../../utils/check-visible';
import { appFlagsService } from '../services/app-flags.service';
import { AppBootstrap, AppStoreProvider } from './index';
import { useFlags, useProject } from './hooks';

type BootstrapUser = Omit<User, 'projectId'> & { projectId?: string };

const auth = vi.hoisted(() => ({
  status: 'authenticated' as AuthStatus,
  user: null as BootstrapUser | null,
}));

vi.mock('../../features/idp', async () => ({
  AuthStatus: (await import('../../features/idp/types')).AuthStatus,
  useAuth: () => auth,
}));

vi.mock('../services/app-flags.service', () => ({
  appFlagsService: { getFlags: vi.fn() },
}));

const getFlags = vi.mocked(appFlagsService.getFlags);

describe('AppBootstrap', () => {
  beforeEach(() => {
    getFlags.mockReset();
    auth.status = AuthStatus.AUTHENTICATED;
    auth.user = { id: 'native-user', roles: [] };
  });

  afterEach(cleanup);

  it('loads flags for a projectless native user before rendering project creation', async () => {
    const flags = deferredFlags();
    getFlags.mockReturnValue(flags.promise);

    renderBootstrap(<NativeProjectControl />);

    expect(getFlags).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Loading application...')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create project' })).not.toBeInTheDocument();

    await act(async () => {
      flags.resolve({ IDP_PROVIDER: 'better-auth' });
      await flags.promise;
    });

    expect(screen.getByRole('button', { name: 'Create project' })).toBeInTheDocument();
    expect(screen.getByText('No project selected')).toBeInTheDocument();
    expect(screen.getByText(RequestStatus.LOADED)).toBeInTheDocument();
    expect(screen.queryByText('Loading application...')).not.toBeInTheDocument();
    expect(getFlags).toHaveBeenCalledTimes(1);
  });

  it('renders request access for an empty-role user with a selected project without loading flags', () => {
    auth.user = { id: 'roleless-user', roles: [], projectId: 'selected-project' };

    renderBootstrap(<RequestAccessControl />);

    expect(screen.getByRole('heading', { name: 'Request project access' })).toBeInTheDocument();
    expect(screen.getByText('selected-project')).toBeInTheDocument();
    expect(screen.queryByText('Loading application...')).not.toBeInTheDocument();
    expect(getFlags).not.toHaveBeenCalled();
  });

  it('keeps project members loading until app flags arrive', async () => {
    auth.user = { id: 'member', roles: ['admin'], projectId: 'selected-project' };
    const flags = deferredFlags();
    getFlags.mockReturnValue(flags.promise);

    renderBootstrap(<NativeProjectControl />);

    expect(getFlags).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Loading application...')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create project' })).not.toBeInTheDocument();

    await act(async () => {
      flags.resolve({ IDP_PROVIDER: 'better-auth' });
      await flags.promise;
    });

    expect(screen.getByRole('button', { name: 'Create project' })).toBeInTheDocument();
    expect(screen.getByText('selected-project')).toBeInTheDocument();
  });

  it.each([AuthStatus.LOADING, AuthStatus.UNAUTHENTICATED, AuthStatus.ERROR])(
    'blocks app content and flags requests while authentication is %s',
    status => {
      auth.status = status;
      auth.user = { id: 'stale-user', roles: [], projectId: 'selected-project' };

      renderBootstrap(<RequestAccessControl />);

      expect(screen.getByText('Loading application...')).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', { name: 'Request project access' })
      ).not.toBeInTheDocument();
      expect(getFlags).not.toHaveBeenCalled();
    }
  );

  it('shows the flags error instead of app content when loading fails', async () => {
    getFlags.mockRejectedValue(new Error('Flags unavailable'));

    renderBootstrap(<NativeProjectControl />);

    expect(
      await screen.findByText('Failed to load app flags: Flags unavailable')
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create project' })).not.toBeInTheDocument();
    expect(getFlags).toHaveBeenCalledTimes(1);
  });
});

function renderBootstrap(children: ReactNode) {
  return render(
    <AppStoreProvider>
      <AppBootstrap>{children}</AppBootstrap>
    </AppStoreProvider>
  );
}

function NativeProjectControl() {
  const { flags, callState } = useFlags();
  const { id } = useProject();
  return (
    <>
      {checkVisible('IDP_PROVIDER', 'better-auth', flags) && <button>Create project</button>}
      <p>{id ?? 'No project selected'}</p>
      <p>{callState}</p>
    </>
  );
}

function RequestAccessControl() {
  const { id } = useProject();
  return (
    <>
      <h1>Request project access</h1>
      <p>{id}</p>
    </>
  );
}

function deferredFlags() {
  let resolve!: (flags: Record<string, unknown>) => void;
  const promise = new Promise<Record<string, unknown>>(resolvePromise => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}
