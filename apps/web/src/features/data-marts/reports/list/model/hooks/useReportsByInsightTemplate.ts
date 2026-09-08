import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { reportService } from '../../../shared';
import { mapReportDtoToEntity } from '../../../shared/model/mappers';
import { ReportStatusEnum } from '../../../shared/enums';
import { toast } from 'sonner';

const REPORTS_BY_INSIGHT_TEMPLATE_QUERY_KEY = 'reports-by-insight-template';

export const useReportsByInsightTemplate = (dataMartId: string, insightTemplateId: string) => {
  return useQuery({
    queryKey: [REPORTS_BY_INSIGHT_TEMPLATE_QUERY_KEY, dataMartId, insightTemplateId],
    queryFn: async () => {
      const response = await reportService.getReportsByInsightTemplateId(
        dataMartId,
        insightTemplateId
      );
      return response.map(mapReportDtoToEntity);
    },
    refetchInterval: query =>
      query.state.data?.some(report => report.lastRunStatus === ReportStatusEnum.RUNNING)
        ? 5000
        : false,
    enabled: !!dataMartId && !!insightTemplateId,
  });
};

export const useDeleteReport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reportId: string) => {
      await reportService.deleteReport(reportId);
      return reportId;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reports'] });
      void queryClient.invalidateQueries({ queryKey: [REPORTS_BY_INSIGHT_TEMPLATE_QUERY_KEY] });
    },
  });
};

export const useRunReport = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reportId: string) => {
      await reportService.runReport(reportId);
      return reportId;
    },
    onSuccess: () => {
      toast.success(t('uiFeedback.reportRunStarted'));
      void queryClient.invalidateQueries({ queryKey: ['reports'] });
      void queryClient.invalidateQueries({
        queryKey: [REPORTS_BY_INSIGHT_TEMPLATE_QUERY_KEY],
        predicate: query => query.queryKey.includes(REPORTS_BY_INSIGHT_TEMPLATE_QUERY_KEY),
      });
    },
    onError: () => {
      toast.error(t('uiFeedback.reportRunFailed'));
    },
  });
};
