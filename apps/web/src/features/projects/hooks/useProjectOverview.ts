import { useQuery } from '@tanstack/react-query';
import { useUser } from '../../idp/hooks/useAuthState';
import { getProjectOverview } from '../services/project-overview.service';

export function useProjectOverview(projectId: string) {
  const user = useUser();
  return useQuery({
    queryKey: ['project-overview', user?.id, projectId],
    queryFn: ({ signal }) => getProjectOverview(projectId, signal),
    enabled: !!user?.id,
    refetchInterval: 15_000,
    retry: false,
    gcTime: 0,
  });
}
