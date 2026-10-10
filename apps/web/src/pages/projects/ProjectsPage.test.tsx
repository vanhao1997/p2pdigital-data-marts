import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectsPage } from './ProjectsPage';

const state = vi.hoisted(() => ({
  navigate: vi.fn(),
  reload: vi.fn().mockResolvedValue(undefined),
  selectProject: vi.fn().mockResolvedValue(undefined),
  provider: 'better-auth',
}));

vi.mock('react-router', () => ({ useNavigate: () => state.navigate }));
vi.mock('../../app/store/hooks', () => ({
  useFlags: () => ({ flags: { IDP_PROVIDER: state.provider } }),
}));
vi.mock('../../features/idp/hooks/useProjects', () => ({
  useProjects: () => ({
    projects: [{ id: 'project-b', title: 'Project B', archived: false }],
    isLoading: false,
    error: null,
    reload: state.reload,
    selectProject: state.selectProject,
  }),
}));
vi.mock('../../features/projects/components/ProjectOverviewDetails', () => ({
  ProjectOverviewDetails: () => null,
}));

describe('ProjectsPage MCP guide entry', () => {
  beforeEach(() => {
    state.provider = 'better-auth';
    state.navigate.mockReset();
    state.selectProject.mockReset().mockResolvedValue(undefined);
  });

  it('selects the target native project before opening its guide', async () => {
    render(<ProjectsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'MCP & ChatGPT guide' }));
    await waitFor(() => {
      expect(state.selectProject).toHaveBeenCalledWith('project-b');
      expect(state.navigate).toHaveBeenCalledWith('/ui/project-b/project-settings/mcp');
    });
  });

  it('uses route authorization for a non-native provider', async () => {
    state.provider = 'owox-better-auth';
    render(<ProjectsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'MCP & ChatGPT guide' }));
    await waitFor(() => {
      expect(state.navigate).toHaveBeenCalledWith('/ui/project-b/project-settings/mcp');
    });
    expect(state.selectProject).not.toHaveBeenCalled();
  });

  it('does not navigate when target project selection fails', async () => {
    state.selectProject.mockRejectedValue(new Error('Project access denied'));
    render(<ProjectsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'MCP & ChatGPT guide' }));
    expect(await screen.findByText('Project access denied')).toBeVisible();
    expect(state.navigate).not.toHaveBeenCalled();
  });
});
