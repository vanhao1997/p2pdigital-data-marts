import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import type { DataMartReport } from '../../../shared/model/types/data-mart-report';
import { ReportFormMode } from '../../../shared';
import { trackEvent } from '../../../../../../utils/data-layer';
import { useUrlParam } from '../../../../../../shared/hooks';

/**
 * Name of the query parameter that deep-links to an open report sidesheet.
 */
export const REPORT_ID_URL_PARAM = 'reportId';

interface UseReportSidesheetOptions {
  /**
   * Enables deep linking via the `reportId` query parameter.
   * When provided, the hook keeps the parameter in sync with the open sidesheet
   * and auto-opens the sidesheet for a report from this list that matches the
   * parameter on initial load.
   */
  deepLinkReports?: DataMartReport[];
}

/**
 * Custom hook for managing report modal states
 * - Handles opening/closing of the modal
 * - Manages "create" and "edit" modes
 * - Stores the currently edited report (if any)
 * - Optionally syncs the edited report id with the URL (deep linking)
 */
export function useReportSidesheet({ deepLinkReports }: UseReportSidesheetOptions = {}) {
  // Controls whether the modal is open
  const [isOpen, setIsOpen] = useState(false);

  // Defines the current modal mode: CREATE or EDIT
  const [mode, setMode] = useState<ReportFormMode>(ReportFormMode.CREATE);

  // Stores the report being edited (null when creating a new one)
  const [editingReport, setEditingReport] = useState<DataMartReport | null>(null);

  const isDeepLinkEnabled = deepLinkReports !== undefined;
  const {
    value: deepLinkReportId,
    setParam: setReportIdParam,
    removeParam: removeReportIdParam,
  } = useUrlParam(REPORT_ID_URL_PARAM);
  const { key: locationKey } = useLocation();
  const pendingReportIdRef = useRef<string | null>(null);
  const justClosedReportRef = useRef<{
    reportId: string;
    locationKey: string;
    restoreReportId: string | null;
  } | null>(null);

  // Async submissions can retain a close callback from before URL navigation
  // commits. Read the latest committed state so closing also removes the owned
  // deep link and the auto-open effect cannot reopen the saved report.
  const closeStateRef = useRef({
    isDeepLinkEnabled,
    mode,
    editingReportId: editingReport?.id ?? null,
    deepLinkReportId,
    locationKey,
  });
  useLayoutEffect(() => {
    closeStateRef.current = {
      isDeepLinkEnabled,
      mode,
      editingReportId: editingReport?.id ?? null,
      deepLinkReportId,
      locationKey,
    };
    if (pendingReportIdRef.current === deepLinkReportId) {
      pendingReportIdRef.current = null;
    }
  }, [isDeepLinkEnabled, mode, editingReport?.id, deepLinkReportId, locationKey]);

  /**
   * Opens the modal in CREATE mode
   * Memoized to prevent unnecessary re-renders of child components
   */
  const handleAddReport = useCallback(() => {
    pendingReportIdRef.current = null;
    justClosedReportRef.current = null;
    setMode(ReportFormMode.CREATE);
    setEditingReport(null);
    setIsOpen(true);
    trackEvent({
      event: 'report_open',
      category: 'Report',
      action: 'CreateReport',
      label: 'ReportForm',
    });
  }, []);

  /**
   * Opens the modal in EDIT mode for a specific report
   * Memoized to prevent unnecessary re-renders of child components
   */
  const handleEditReport = useCallback(
    (report: DataMartReport) => {
      justClosedReportRef.current = null;
      setMode(ReportFormMode.EDIT);
      setEditingReport(report);
      setIsOpen(true);
      if (isDeepLinkEnabled) {
        // Opening state can commit before the router transition that sets this id.
        pendingReportIdRef.current = report.id;
        setReportIdParam(report.id);
      }
      trackEvent({
        event: 'report_open',
        category: 'Report',
        action: 'EditReport',
        label: report.dataDestination.type,
      });
    },
    [isDeepLinkEnabled, setReportIdParam]
  );

  /**
   * Closes the modal and resets the editing report
   * Memoized to prevent unnecessary re-renders of child components
   */
  const handleCloseModal = useCallback(() => {
    const current = closeStateRef.current;
    setIsOpen(false);
    setEditingReport(null);
    // Remove the param only when this sidesheet instance owns it — every card on
    // the page shares the param, and closing an unrelated (e.g. CREATE-mode) sheet
    // must not clobber a deep link another card has not resolved yet.
    if (
      current.isDeepLinkEnabled &&
      current.editingReportId !== null &&
      (current.editingReportId === current.deepLinkReportId ||
        current.editingReportId === pendingReportIdRef.current)
    ) {
      const restoreReportId =
        current.deepLinkReportId === current.editingReportId ? null : current.deepLinkReportId;
      justClosedReportRef.current = {
        reportId: current.editingReportId,
        locationKey: current.locationKey,
        restoreReportId,
      };
      // Cancel a pending owned set while preserving another card's committed deep link.
      if (restoreReportId === null) {
        removeReportIdParam();
      } else {
        setReportIdParam(restoreReportId);
      }
    }
    pendingReportIdRef.current = null;
    trackEvent({
      event: 'report_close',
      category: 'Report',
      action: current.mode === ReportFormMode.EDIT ? 'Edit' : 'Create',
      label: 'ReportForm',
    });
  }, [removeReportIdParam, setReportIdParam]);

  // Auto-open the sidesheet for a deep-linked report once it appears in the list.
  // Guarded by isOpen (not a one-shot ref): a manual open sets the param itself, so
  // the effect must not re-fire handleEditReport for it, while a new param arriving
  // after a close must still open — both fall out of the isOpen check.
  useEffect(() => {
    if (!isDeepLinkEnabled) {
      return;
    }
    const justClosedReport = justClosedReportRef.current;
    if (!deepLinkReportId) {
      // The old null URL can render again before the queued set/removal commits.
      // Only a new committed location acknowledges removal and permits a later link.
      if (justClosedReport && locationKey !== justClosedReport.locationKey) {
        justClosedReportRef.current = null;
      }
      return;
    }
    if (deepLinkReportId === justClosedReport?.restoreReportId) {
      // Keep the cancellation guard while the original foreign URL renders again.
      if (locationKey === justClosedReport.locationKey) {
        return;
      }
      justClosedReportRef.current = null;
    }
    if (isOpen) {
      return;
    }
    if (deepLinkReportId === justClosedReport?.reportId) {
      if (locationKey !== justClosedReport.locationKey) {
        justClosedReportRef.current = { ...justClosedReport, locationKey };
        if (justClosedReport.restoreReportId === null) {
          removeReportIdParam();
        } else {
          setReportIdParam(justClosedReport.restoreReportId);
        }
      }
      return;
    }
    justClosedReportRef.current = null;
    const report = deepLinkReports.find(item => item.id === deepLinkReportId);
    if (report) {
      handleEditReport(report);
    }
  }, [
    isDeepLinkEnabled,
    deepLinkReports,
    deepLinkReportId,
    locationKey,
    isOpen,
    handleEditReport,
    removeReportIdParam,
    setReportIdParam,
  ]);

  return {
    isOpen,
    mode,
    editingReport,
    handleAddReport,
    handleEditReport,
    handleCloseModal,
  };
}
