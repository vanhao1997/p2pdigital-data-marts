import { it, expect, vi } from 'vitest';
import apiClient from '../../../app/api/apiClient';
import { getProjectOverview } from './project-overview.service';

vi.mock('../../../app/api/apiClient', () => ({ default: { get: vi.fn() } }));

it('uses the explicit project endpoint with cancellable, silent requests', async () => {
  const signal = new AbortController().signal;
  const data = { projectId: 'project/b', dataMartsCount: 0 };
  vi.mocked(apiClient.get).mockResolvedValue({ data });
  expect(await getProjectOverview('project/b', signal)).toEqual(data);
  expect(apiClient.get).toHaveBeenCalledWith('/project-overviews/project%2Fb', {
    signal,
    skipLoadingIndicator: true,
    skipErrorToast: true,
  });
});
