import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { reportService, reportStatusPollingService } from '../../services';
import { dataDestinationService } from '../../../../../data-destination';
import type { CreateReportRequestDto, UpdateReportRequestDto } from '../../services';
import type { ReportStatusPollingConfig } from '../../services';
import { useReportContext, ReportActionType } from '../context';
import { mapReportDtoToEntity } from '../mappers';
import { toast } from 'sonner';
import { trackEvent } from '../../../../../../utils';
import { useRefreshSetupProgress } from '../../../../../../components/AppSidebar/SetupChecklist/useSetupProgress';
import { ReportStatusEnum } from '../../enums';

export function useReport() {
  const { t } = useTranslation();
  const { state, dispatch, reportsRequestGenerationRef } = useReportContext();
  const refreshSetupProgress = useRefreshSetupProgress();

  const fetchDestinations = useCallback(async () => {
    dispatch({ type: ReportActionType.FETCH_DESTINATIONS_START });
    try {
      const destinations = await dataDestinationService.getDataDestinations();
      dispatch({ type: ReportActionType.FETCH_DESTINATIONS_SUCCESS, payload: destinations });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('reportStatus.errors.loadDestinations');
      dispatch({
        type: ReportActionType.FETCH_DESTINATIONS_ERROR,
        payload: message,
      });
      trackEvent({
        event: 'report_error',
        category: 'Report',
        action: 'DestinationsListError',
        label: message,
      });
    }
  }, [dispatch, t]);

  const fetchReports = useCallback(async () => {
    const requestId = ++reportsRequestGenerationRef.current;
    dispatch({
      type: ReportActionType.FETCH_REPORTS_START,
      payload: { requestId, silent: false },
    });
    try {
      const reports = await reportService.getReportsByProject();
      const mappedReports = reports.map(mapReportDtoToEntity);
      dispatch({
        type: ReportActionType.FETCH_REPORTS_SUCCESS,
        payload: { requestId, reports: mappedReports, silent: false },
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : t('reportStatus.errors.loadReports');
      dispatch({
        type: ReportActionType.FETCH_REPORTS_ERROR,
        payload: { requestId, error: message, silent: false },
      });
      trackEvent({
        event: 'report_error',
        category: 'Report',
        action: 'ListError',
        error: message,
      });
      return false;
    }
  }, [dispatch, reportsRequestGenerationRef, t]);

  const fetchReportsByDataMartId = useCallback(
    async (dataMartId: string, options?: { silent?: boolean; signal?: AbortSignal }) => {
      const requestId = ++reportsRequestGenerationRef.current;
      const silent = options?.silent === true;
      const signal = options?.signal;
      dispatch({
        type: ReportActionType.FETCH_REPORTS_START,
        payload: { requestId, silent },
      });
      try {
        const reports = await reportService.getReportsByDataMartId(
          dataMartId,
          silent || signal
            ? {
                ...(silent ? { skipLoadingIndicator: true, skipErrorToast: true } : {}),
                ...(signal ? { signal } : {}),
              }
            : undefined
        );
        const mappedReports = reports.map(mapReportDtoToEntity);
        dispatch({
          type: ReportActionType.FETCH_REPORTS_SUCCESS,
          payload: { requestId, reports: mappedReports, silent },
        });
        return true;
      } catch (error) {
        if (signal?.aborted) return false;
        const message =
          error instanceof Error ? error.message : t('reportStatus.errors.loadReports');
        dispatch({
          type: ReportActionType.FETCH_REPORTS_ERROR,
          payload: { requestId, error: message, silent },
        });
        trackEvent({
          event: 'report_error',
          category: 'Report',
          action: 'ListError',
          error: message,
        });
        return false;
      }
    },
    [dispatch, reportsRequestGenerationRef, t]
  );

  const fetchReportById = useCallback(
    async (id: string) => {
      dispatch({ type: ReportActionType.FETCH_REPORT_START });
      try {
        const report = await reportService.getReportById(id);
        const mappedReport = mapReportDtoToEntity(report);
        dispatch({ type: ReportActionType.FETCH_REPORT_SUCCESS, payload: mappedReport });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : t('reportStatus.errors.loadReport');
        dispatch({
          type: ReportActionType.FETCH_REPORT_ERROR,
          payload: message,
        });
        trackEvent({
          event: 'report_error',
          category: 'Report',
          action: 'GetError',
          error: message,
        });
      }
    },
    [dispatch, t]
  );

  const createReport = useCallback(
    async (data: CreateReportRequestDto) => {
      dispatch({ type: ReportActionType.CREATE_REPORT_START });
      try {
        const report = await reportService.createReport(data);
        const mappedReport = mapReportDtoToEntity(report);
        dispatch({ type: ReportActionType.CREATE_REPORT_SUCCESS, payload: mappedReport });
        trackEvent({
          event: 'report_created',
          category: 'Report',
          action: 'Create',
          label: mappedReport.dataDestination.type,
          details: mappedReport.title,
          context: mappedReport.dataMart.id,
        });
        toast.success(t('uiFeedback.reportCreated'));
        refreshSetupProgress();
        return mappedReport;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : t('reportStatus.errors.createReport');
        dispatch({
          type: ReportActionType.CREATE_REPORT_ERROR,
          payload: message,
        });
        trackEvent({
          event: 'report_error',
          category: 'Report',
          action: 'CreateError',
          label: data.destinationConfig.type,
          error: message,
        });
        return null;
      }
    },
    [dispatch, refreshSetupProgress, t]
  );

  const updateReport = useCallback(
    async (id: string, data: UpdateReportRequestDto) => {
      dispatch({ type: ReportActionType.UPDATE_REPORT_START });
      try {
        const report = await reportService.updateReport(id, data);
        const mappedReport = mapReportDtoToEntity(report);
        dispatch({ type: ReportActionType.UPDATE_REPORT_SUCCESS, payload: mappedReport });
        trackEvent({
          event: 'report_updated',
          category: 'Report',
          action: 'Update',
          label: mappedReport.dataDestination.type,
          value: mappedReport.title,
          context: mappedReport.dataMart.id,
          details: mappedReport.id,
        });
        toast.success(t('uiFeedback.reportUpdated'));
        return mappedReport;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : t('reportStatus.errors.updateReport');
        dispatch({
          type: ReportActionType.UPDATE_REPORT_ERROR,
          payload: message,
        });
        trackEvent({
          event: 'report_error',
          category: 'Report',
          action: 'UpdateError',
          error: message,
        });
        return null;
      }
    },
    [dispatch, t]
  );

  const deleteReport = useCallback(
    async (id: string) => {
      dispatch({ type: ReportActionType.DELETE_REPORT_START });
      try {
        await reportService.deleteReport(id);
        dispatch({ type: ReportActionType.DELETE_REPORT_SUCCESS, payload: id });
        trackEvent({
          event: 'report_deleted',
          category: 'Report',
          action: 'Delete',
          label: id,
        });
        toast.success(t('uiFeedback.reportDeleted'));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : t('reportStatus.errors.deleteReport');
        dispatch({
          type: ReportActionType.DELETE_REPORT_ERROR,
          payload: message,
        });
        trackEvent({
          event: 'report_error',
          category: 'Report',
          action: 'DeleteError',
          label: id,
          error: message,
        });
        throw error;
      }
    },
    [dispatch, t]
  );

  const clearCurrentReport = useCallback(() => {
    dispatch({ type: ReportActionType.CLEAR_CURRENT_REPORT });
  }, [dispatch]);

  const clearError = useCallback(() => {
    dispatch({ type: ReportActionType.CLEAR_ERROR });
  }, [dispatch]);

  const stopPollingReport = useCallback(
    (reportId: string) => {
      reportStatusPollingService.stopPolling(reportId);
      dispatch({ type: ReportActionType.STOP_POLLING_REPORT, payload: reportId });
    },
    [dispatch]
  );

  const startPollingReport = useCallback(
    (reportId: string) => {
      // If we're already polling this report, stop polling first
      if (state.polledReportIds.includes(reportId)) {
        stopPollingReport(reportId);
      }

      // Dispatch action to add report to polledReportIds
      dispatch({ type: ReportActionType.START_POLLING_REPORT, payload: reportId });

      reportStatusPollingService.startPolling(reportId, reportDto => {
        const mappedReport = mapReportDtoToEntity(reportDto);

        // Dispatch action to update the report in state
        // The reducer will handle checking if the status has changed
        dispatch({ type: ReportActionType.UPDATE_POLLED_REPORT, payload: mappedReport });
        if (mappedReport.lastRunStatus === ReportStatusEnum.SUCCESS) {
          refreshSetupProgress();
        }
      });
    },
    [dispatch, state.polledReportIds, stopPollingReport, refreshSetupProgress]
  );

  const stopAllPolling = useCallback(() => {
    reportStatusPollingService.stopAllPolling();

    // Dispatch action to clear all polled report IDs
    dispatch({ type: ReportActionType.STOP_ALL_POLLING });
  }, [dispatch]);

  const setPollingConfig = useCallback((config: Partial<ReportStatusPollingConfig>) => {
    reportStatusPollingService.setConfig(config);
  }, []);

  // Returns whether the run actually started. Errors are handled here (tracked
  // and logged, HTTP errors toasted by the interceptor), but callers holding an
  // optimistic "running" flag need the outcome to release it — lastRunStatus
  // does not change on a failed start, so status-sync effects never fire.
  const runReport = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        // Stop any existing polling for this report
        stopPollingReport(id);

        await reportService.runReport(id);
        // Fetch the report to update its status
        await fetchReportById(id);
        // Start polling for status updates
        startPollingReport(id);
        trackEvent({
          event: 'report_run_started',
          category: 'Report',
          action: 'Run',
          label: id,
        });
        toast.success(t('uiFeedback.reportRunStarted'));
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : t('uiFeedback.reportRunFailed');
        trackEvent({
          event: 'report_error',
          category: 'Report',
          action: 'RunError',
          error: message,
        });
        console.error('Failed to run report:', error);
        return false;
      }
    },
    [fetchReportById, startPollingReport, stopPollingReport, t]
  );

  // Clean up polling when component unmounts
  useEffect(() => {
    return () => {
      stopAllPolling();
    };
  }, [stopAllPolling]);

  return {
    destinations: state.destinations,
    reports: state.reports,
    currentReport: state.currentReport,
    loading: state.loading,
    error: state.error,
    polledReportIds: state.polledReportIds,
    fetchDestinations,
    fetchReports,
    fetchReportsByDataMartId,
    fetchReportById,
    createReport,
    updateReport,
    deleteReport,
    runReport,
    startPollingReport,
    stopPollingReport,
    stopAllPolling,
    setPollingConfig,
    clearCurrentReport,
    clearError,
  };
}
