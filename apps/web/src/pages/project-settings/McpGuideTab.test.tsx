import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../i18n';
import type { User } from '../../features/idp/types';
import { McpGuideTab } from './McpGuideTab';

const currentUser = vi.hoisted(() => ({ value: null as User | null }));
const clipboard = vi.hoisted(() => ({
  copyToClipboard: vi.fn().mockResolvedValue(true),
  copiedSection: null as string | null,
}));

vi.mock('../../features/idp/hooks/useAuthState', () => ({ useUser: () => currentUser.value }));
vi.mock('../../shared/hooks', () => ({
  useProjectRoute: () => ({
    scope: (path: string) => `/ui/${currentUser.value?.projectId}${path}`,
  }),
}));
vi.mock('../../hooks/useClipboard', () => ({ useClipboard: () => clipboard }));

describe('McpGuideTab', () => {
  beforeEach(() => {
    currentUser.value = {
      id: 'u1',
      projectId: 'project-a',
      projectTitle: 'Project A',
      roles: ['admin'],
    };
    clipboard.copyToClipboard.mockReset().mockResolvedValue(true);
    clipboard.copiedSection = null;
  });

  it('shows the published DigitalReport endpoint when auth has no project URL', async () => {
    renderGuide();
    expect(screen.getByText('https://digitalreport.p2pdigital.io.vn/mcp')).toBeVisible();
    expect(screen.getByText(/self-hosted installation/)).toBeVisible();
    expect(screen.getByText(/does not prove OAuth readiness/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Copy Server URL' }));
    await waitFor(() => {
      expect(clipboard.copyToClipboard).toHaveBeenCalledWith(
        'https://digitalreport.p2pdigital.io.vn/mcp',
        'mcp-endpoint'
      );
    });
  });

  it('prefers the server-provided project URL without building a subdomain', () => {
    const projectUrl = 'https://project-a.mcp.example.com/mcp';
    currentUser.value!.mcpServerUrl = projectUrl;
    renderGuide();
    expect(screen.getByText(projectUrl)).toBeVisible();
    expect(
      screen.queryByText('https://digitalreport.p2pdigital.io.vn/mcp')
    ).not.toBeInTheDocument();
  });

  it('copies prompts with exact project scope and no automatic publish/sync', async () => {
    renderGuide();
    for (const [label, section] of [
      ['Copy draft prompt', 'mcp-draft-prompt'],
      ['Copy validation prompt', 'mcp-validation-prompt'],
    ]) {
      fireEvent.click(screen.getByRole('button', { name: label }));
      await waitFor(() => {
        expect(clipboard.copyToClipboard).toHaveBeenCalledWith(
          expect.stringContaining('current_project.id is project-a'),
          section
        );
      });
      const prompt = clipboard.copyToClipboard.mock.calls.at(-1)![0] as string;
      expect(prompt).toContain('Stop if it differs.');
      expect(prompt).toContain('Do not publish, run sync or create schedules.');
      expect(prompt).not.toContain('{{projectId}}');
    }
    expect(screen.getByRole('link', { name: 'Open Data Marts to verify' })).toHaveAttribute(
      'href',
      '/ui/project-a/data-marts'
    );
  });

  it('updates the expected project when auth context changes', () => {
    const { rerender } = renderGuide();
    currentUser.value = {
      ...currentUser.value!,
      projectId: 'project-b',
      projectTitle: 'Project B',
    };
    rerender(
      <MemoryRouter>
        <McpGuideTab />
      </MemoryRouter>
    );
    expect(screen.queryByText(/current_project.id is project-a/)).not.toBeInTheDocument();
    expect(screen.getAllByText(/current_project.id is project-b/)).toHaveLength(2);
  });

  it('shows clipboard failure without claiming success', async () => {
    clipboard.copyToClipboard.mockResolvedValue(false);
    renderGuide();
    fireEvent.click(screen.getByRole('button', { name: 'Copy Server URL' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not copy');
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('does not offer project prompt copying without a selected project', () => {
    currentUser.value = null;
    renderGuide();
    expect(screen.queryByRole('button', { name: 'Copy draft prompt' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Copy validation prompt' })
    ).not.toBeInTheDocument();
  });

  it('renders Vietnamese safety guidance, troubleshooting and documentation links', async () => {
    await i18n.changeLanguage('vi');
    currentUser.value!.projectArchived = true;
    renderGuide();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Kết nối ChatGPT với DigitalReport'
    );
    expect(screen.getByRole('alert')).toHaveTextContent('chỉ đọc');
    expect(screen.getByText(/Không dán vào ChatGPT/)).toBeVisible();
    expect(screen.getByText(/phát sinh mức tiêu thụ/)).toBeVisible();
    expect(screen.getByText(/quyền mcp:write không giúp truy cập/)).toBeVisible();
    expect(screen.getByText(/có thể được gửi sang OpenAI/)).toBeVisible();
    expect(screen.getByText('Callback hoặc redirect bị từ chối')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Tài liệu MCP đầy đủ' })).toHaveAttribute(
      'href',
      expect.stringContaining('/vi/getting-started/setup-guide/mcp/')
    );
    expect(screen.getByRole('link', { name: 'OpenAI Docs' })).toHaveAttribute(
      'href',
      'https://developers.openai.com/api/docs/guides/custom-mcp-server'
    );
  });
});

function renderGuide() {
  return render(
    <MemoryRouter>
      <McpGuideTab />
    </MemoryRouter>
  );
}
