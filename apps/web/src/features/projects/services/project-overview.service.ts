import apiClient from '../../../app/api/apiClient';
import type { AxiosRequestConfig } from '../../../app/api/apiClient';
import type { ProjectOverview } from '../types/project-overview';

export async function getProjectOverview(
  projectId: string,
  signal?: AbortSignal
): Promise<ProjectOverview> {
  const response = await apiClient.get<ProjectOverview>(
    `/project-overviews/${encodeURIComponent(projectId)}`,
    {
      signal,
      skipLoadingIndicator: true,
      skipErrorToast: true,
    } as AxiosRequestConfig
  );
  return response.data;
}
