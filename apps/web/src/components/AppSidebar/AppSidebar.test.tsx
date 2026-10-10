import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { SidebarProvider, SidebarTrigger } from '@owox/ui/components/sidebar';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppSidebar } from './AppSidebar';

vi.mock('../../shared/hooks', () => ({
  useProjectRoute: () => ({ scope: (path: string) => `/ui/project-1${path}` }),
}));
vi.mock('./ProjectMenu', () => ({ SidebarProjectMenu: () => null }));
vi.mock('./UserMenu', () => ({
  UserMenu: () => <button>Account menu</button>,
}));
vi.mock('./PluginsMenu/PluginsMenu', () => ({ PluginsMenu: () => null }));
vi.mock('./HelpMenu', () => ({ HelpMenu: () => null }));
vi.mock('./SetupChecklist/useSetupChecklistVisibility', () => ({
  useSetupChecklistVisibility: () => ({ isVisible: false }),
}));

function CurrentPage() {
  return <output aria-label='Current page'>{useLocation().pathname}</output>;
}

function renderSidebar(path = '/ui/project-1/data-marts') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SidebarProvider>
        <SidebarTrigger />
        <AppSidebar />
        <CurrentPage />
      </SidebarProvider>
    </MemoryRouter>
  );
}

describe('AppSidebar navigation', () => {
  beforeEach(() => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(390);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ['Storages', '/ui/project-1/data-storages'],
    ['Reports', '/ui/project-1/data-marts/reports'],
    ['New Data Mart', '/ui/project-1/data-marts/create'],
    ['Search', '/ui/project-1/search'],
    ['Data Marts', '/ui/project-1/data-marts'],
  ])('closes the mobile sidebar after navigating to %s', async (label, path) => {
    renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: 'Toggle Sidebar' }));
    const sidebar = await screen.findByRole('dialog', { name: 'Sidebar' });

    fireEvent.click(within(sidebar).getByRole('link', { name: new RegExp(`^${label}`) }));

    expect(screen.getByLabelText('Current page')).toHaveTextContent(path);
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Sidebar' })).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Toggle Sidebar' }));
    expect(await screen.findByRole('dialog', { name: 'Sidebar' })).toBeInTheDocument();
  });

  it('keeps the mobile sidebar open during interactions that do not navigate', async () => {
    renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: 'Toggle Sidebar' }));
    const sidebar = await screen.findByRole('dialog', { name: 'Sidebar' });

    fireEvent.click(within(sidebar).getByRole('button', { name: 'Account menu' }));

    expect(screen.getByRole('dialog', { name: 'Sidebar' })).toBeInTheDocument();
  });

  it('keeps the desktop sidebar expanded after navigation', () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1440);
    const { container } = renderSidebar();

    fireEvent.click(screen.getByRole('link', { name: 'Storages' }));

    expect(screen.getByLabelText('Current page')).toHaveTextContent('/ui/project-1/data-storages');
    expect(container.querySelector('[data-state="expanded"][data-slot="sidebar"]')).not.toBeNull();
    expect(screen.queryByRole('dialog', { name: 'Sidebar' })).not.toBeInTheDocument();
  });
});
