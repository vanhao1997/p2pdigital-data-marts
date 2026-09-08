import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  DestinationCard,
  EmptyDataMartDestinationsState,
} from '../../../features/data-marts/reports/list/components';
import { REPORT_ID_URL_PARAM } from '../../../features/data-marts/reports/list/model/hooks';
import { useReport } from '../../../features/data-marts/reports/shared';
import { useOutletContext } from 'react-router';
import type { DataMartContextType } from '../../../features/data-marts/edit/model/context/types';
import { SkeletonList } from '@owox/ui/components/common/skeleton-list';
import {
  useDataDestinationsWithReports,
  DataDestinationProvider,
  type DataDestination,
  DataDestinationType,
} from '../../../features/data-destination/shared';
import { DataDestinationConfigSheet } from '../../../features/data-destination/edit';
import { ReportsProvider } from '../../../features/data-marts/reports/shared/model/context';
import { useDataMartReportsAutoRefresh } from '../../../features/data-marts/reports/shared/model/hooks/useDataMartReportsAutoRefresh';
import { useOnboardingVideo } from '../../../shared/hooks/useOnboardingVideo';
import { DataMartStatus } from '../../../features/data-marts/shared/enums';
import { PromoBlock } from '../../../shared/components/PromoBlock/PromoBlock';
import { GoogleSheetsIcon } from '../../../shared/icons/google-sheets-icon';
import { InviteTeammatesCard } from '../../../shared/components/InviteTeammatesCard';
import { useProjectRoute } from '../../../shared/hooks/useProjectRoute';
import { useUrlParam } from '../../../shared/hooks';
import { useTranslation } from 'react-i18next';

function DataMartDestinationsContentInner() {
  const { t } = useTranslation();
  const { dataMart, publishDataMartWithEffects } = useOutletContext<DataMartContextType>();
  const { dataDestinations, isLoading, hasLoadError, retry, fetchDataDestinations } =
    useDataDestinationsWithReports();
  const [isCreateDestinationOpen, setIsCreateDestinationOpen] = useState(false);
  const { scope, navigate } = useProjectRoute();
  const handleOpenCreateDestination = useCallback(() => {
    setIsCreateDestinationOpen(true);
  }, []);

  const handleCloseCreateDestination = useCallback(() => {
    setIsCreateDestinationOpen(false);
  }, []);
  // Centralized reports polling for this Data Mart
  useDataMartReportsAutoRefresh({ enabled: true, intervalMs: 5000, initialFetch: false });

  // Deep link handling: DestinationCard opens the report sidesheet for a matching
  // reportId query param; here we only clean up a param that matches no report.
  const { value: deepLinkReportId, removeParam: removeReportIdParam } =
    useUrlParam(REPORT_ID_URL_PARAM);
  const { reports, loading: reportsLoading } = useReport();
  // The context starts with an empty reports array and keeps it on a failed fetch,
  // so "a successful fetch happened" is detected by the array identity changing —
  // never conclude "not found" from the initial (or error-preserved) state.
  const initialReportsRef = useRef(reports);
  const checkedReportIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      !deepLinkReportId ||
      reportsLoading ||
      reports === initialReportsRef.current ||
      checkedReportIdRef.current === deepLinkReportId
    ) {
      return;
    }
    checkedReportIdRef.current = deepLinkReportId;
    if (!reports.some(report => report.id === deepLinkReportId)) {
      toast.error(t('reportsUi.reportNotFound', { id: deepLinkReportId }));
      removeReportIdParam();
    }
  }, [reportsLoading, reports, deepLinkReportId, removeReportIdParam, t]);

  // Show onboarding video about email reports if the user has not seen it yet
  const shouldShowOnboarding = !isLoading && dataDestinations.length === 0;
  useOnboardingVideo({
    storageKey: 'email-reports-onboarding-video-shown',
    popoverId: 'video-6-email-reports',
    shouldShow: shouldShowOnboarding,
  });

  const isPublished = dataMart?.status.code === DataMartStatus.PUBLISHED;

  const hasGoogleSheetsDestination = dataDestinations.some(
    destination => destination.type === DataDestinationType.GOOGLE_SHEETS
  );

  const showSheetsUpsellPromo =
    dataDestinations.length > 0 && !hasGoogleSheetsDestination && isPublished;

  if (!dataMart) return null;

  return (
    <div className='flex flex-col gap-4' data-testid='destTab'>
      {isLoading ? (
        <SkeletonList />
      ) : hasLoadError ? (
        <div className='dm-card-block flex flex-col items-center gap-3 text-center text-sm'>
          <p className='text-muted-foreground'>{t('reportsUi.loadFailed')}</p>
          <button
            type='button'
            className='border-input hover:bg-muted rounded-md border px-3 py-1.5 transition-colors'
            onClick={() => void retry()}
          >
            {t('common.retry', 'Retry')}
          </button>
        </div>
      ) : dataDestinations.length === 0 ? (
        <EmptyDataMartDestinationsState
          variant={isPublished ? 'promo' : 'default'}
          onOpenCreateDestination={isPublished ? handleOpenCreateDestination : undefined}
        />
      ) : (
        <>
          {dataDestinations.map((destination: DataDestination) => (
            <DestinationCard
              key={destination.id}
              destination={destination}
              dataMartStatus={dataMart.status}
              canPublish={dataMart.canPublish}
              validationErrors={dataMart.validationErrors}
              onPublishDataMart={publishDataMartWithEffects}
              onReviewDataSetup={() => {
                navigate(`/data-marts/${dataMart.id}/data-setup`);
              }}
            />
          ))}
          {showSheetsUpsellPromo && (
            <div className='flex flex-col gap-0.5'>
              <PromoBlock
                icon={GoogleSheetsIcon}
                size='compact'
                title={t('reportsEmptyDestinations.analyzeTitle')}
                description={t('reportsEmptyDestinations.description')}
                primaryAction={{
                  label: t('reportsEmptyDestinations.connectSheets'),
                  onClick: handleOpenCreateDestination,
                }}
                secondaryAction={{
                  label: t('reportsEmptyDestinations.viewDestinations'),
                  href: scope('/data-destinations'),
                }}
              />
              <InviteTeammatesCard
                hint={t('destinationsPage.inviteHint')}
                docsLabel={t('reportsEmptyDestinations.learnMore')}
                docsHref='https://docs.p2pdigital.io.vn/docs/destinations/supported-destinations/google-sheets/?utm_source=owox_data_marts&utm_medium=dm_page_destinations_tab&utm_campaign=no_sheets_destination_invite_teammates_card'
              />
            </div>
          )}
        </>
      )}

      <DataDestinationConfigSheet
        isOpen={isCreateDestinationOpen}
        onClose={handleCloseCreateDestination}
        dataDestination={null}
        initialFormData={{
          title: t('dataDestinationForm.googleSheetsTitle', 'New Google Sheets Destination'),
          type: DataDestinationType.GOOGLE_SHEETS,
          credentials: {
            serviceAccount: '',
            credentialId: null,
          },
        }}
        allowedDestinationTypes={[DataDestinationType.GOOGLE_SHEETS]}
        onSaveSuccess={() => {
          void fetchDataDestinations().then(destinations => {
            // Keep the sheet open when the refresh fails so the user can retry
            // without losing the successful form state.
            if (destinations !== undefined) {
              setIsCreateDestinationOpen(false);
            }
          });
        }}
      />
    </div>
  );
}

export default function DataMartDestinationsContent() {
  return (
    <DataDestinationProvider>
      <ReportsProvider>
        <DataMartDestinationsContentInner />
      </ReportsProvider>
    </DataDestinationProvider>
  );
}
