import React, { useMemo, useCallback } from 'react';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  HoverCardHeader,
  HoverCardHeaderText,
  HoverCardHeaderIcon,
  HoverCardHeaderTitle,
  HoverCardHeaderDescription,
  HoverCardBody,
  HoverCardItem,
  HoverCardItemLabel,
  HoverCardItemValue,
  HoverCardFooter,
} from '@owox/ui/components/hover-card';
import { DataDestinationTypeModel } from '../../../../../data-destination';
import type { DataMartReport } from '../../model/types/data-mart-report';
import { isGoogleSheetsDestinationConfig } from '../../model/types/data-mart-report';
import { type ReactNode } from 'react';
import RelativeTime from '@owox/ui/components/common/relative-time';
import { getGoogleSheetTabUrl } from '../../utils';
import { Button } from '@owox/ui/components/button';
import { ExternalLink } from 'lucide-react';
import { StatusLabel } from '../../../../../../shared/components/StatusLabel';
import { mapReportStatusToStatusType } from '../../../../shared';
import { ReportStatusEnum } from '../../enums';
import { useTranslation } from 'react-i18next';
import { getOperationalErrorDisplayMessage } from '../../../../../../shared/utils/localize-operational-error';

interface ReportHoverCardProps {
  report: DataMartReport;
  children: ReactNode;
}

const useDateFormatters = () => {
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage === 'vi' ? 'vi-VN' : 'en-US';
  const detailedDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [locale]
  );

  const shortDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
    [locale]
  );

  return { detailedDateFormatter, shortDateFormatter };
};

export const ReportHoverCard = React.memo(
  function ReportHoverCard({ report, children }: ReportHoverCardProps) {
    const { t } = useTranslation();
    const { detailedDateFormatter, shortDateFormatter } = useDateFormatters();

    const statusInfo = useMemo(() => {
      if (!report.lastRunStatus) return null;
      return {
        statusType: mapReportStatusToStatusType(report.lastRunStatus),
        statusText: {
          [ReportStatusEnum.SUCCESS]: t('reportStatus.success', 'Success'),
          [ReportStatusEnum.RUNNING]: t('reportStatus.inProgress', 'In progress'),
          [ReportStatusEnum.ERROR]: t('reportStatus.fail', 'Fail'),
          [ReportStatusEnum.CANCELLED]: t('reportStatus.cancelled', 'Cancelled'),
          [ReportStatusEnum.RESTRICTED]: t('reportStatus.restricted', 'Restricted'),
        }[report.lastRunStatus],
      };
    }, [report.lastRunStatus, t]);

    const formattedDates = useMemo(() => {
      return {
        modifiedAt: detailedDateFormatter.format(new Date(report.modifiedAt)),
        createdAt: shortDateFormatter.format(new Date(report.createdAt)),
      };
    }, [report.modifiedAt, report.createdAt, detailedDateFormatter, shortDateFormatter]);

    const DestinationIcon = useMemo(() => {
      return DataDestinationTypeModel.getInfo(report.dataDestination.type).icon;
    }, [report.dataDestination.type]);

    const buttonConfig = useMemo(() => {
      if (isGoogleSheetsDestinationConfig(report.destinationConfig)) {
        return {
          isGoogleSheets: true,
          spreadsheetId: report.destinationConfig.spreadsheetId,
          sheetId: report.destinationConfig.sheetId,
        };
      }
      return {
        isGoogleSheets: false,
        spreadsheetId: null,
        sheetId: null,
      };
    }, [report.destinationConfig]);

    const handleGoogleSheetOpen = useCallback(() => {
      if (!buttonConfig.isGoogleSheets || !buttonConfig.spreadsheetId || !buttonConfig.sheetId) {
        return;
      }

      const sheetUrl = getGoogleSheetTabUrl(buttonConfig.spreadsheetId, buttonConfig.sheetId);
      window.open(sheetUrl, '_blank', 'noopener,noreferrer');
    }, [buttonConfig]);

    return (
      <HoverCard>
        <HoverCardTrigger asChild>
          <span>{children}</span>
        </HoverCardTrigger>
        <HoverCardContent>
          <HoverCardHeader>
            <HoverCardHeaderIcon>
              <DestinationIcon size={20} />
            </HoverCardHeaderIcon>
            <HoverCardHeaderText>
              <HoverCardHeaderTitle>
                {report.title || t('reportsUi.unnamedReport', 'Unnamed Report')}
              </HoverCardHeaderTitle>
              <HoverCardHeaderDescription>
                {t('reportsUi.lastModified', 'Last modified')}{' '}
                <RelativeTime date={new Date(report.modifiedAt)} />
              </HoverCardHeaderDescription>
            </HoverCardHeaderText>
          </HoverCardHeader>

          <HoverCardBody>
            {statusInfo && (
              <HoverCardItem>
                <HoverCardItemLabel>
                  {t('reportActions.lastRunStatus', 'Last run status:')}
                </HoverCardItemLabel>
                <HoverCardItemValue>
                  <StatusLabel type={statusInfo.statusType} variant='ghost'>
                    {statusInfo.statusText}
                  </StatusLabel>
                </HoverCardItemValue>
              </HoverCardItem>
            )}
            {report.lastRunDate && (
              <HoverCardItem>
                <HoverCardItemLabel>
                  {t('reportActions.lastRunDate', 'Last run date:')}
                </HoverCardItemLabel>
                <HoverCardItemValue>
                  <RelativeTime date={report.lastRunDate} />
                </HoverCardItemValue>
              </HoverCardItem>
            )}
            {report.lastRunError && getOperationalErrorDisplayMessage(report.lastRunError) && (
              <HoverCardItem>
                <HoverCardItemLabel>
                  {t('reportActions.errorMessage', 'Error message:')}
                </HoverCardItemLabel>
                <HoverCardItemValue>
                  {getOperationalErrorDisplayMessage(report.lastRunError)}
                </HoverCardItemValue>
              </HoverCardItem>
            )}
            <HoverCardItem>
              {report.runsCount > 0 ? (
                <HoverCardItemLabel>
                  {t('reportActions.totalRuns', 'Total runs:')}
                </HoverCardItemLabel>
              ) : (
                ''
              )}
              <HoverCardItemValue>
                {report.runsCount === 0
                  ? t('reportsUi.noRuns', 'No runs')
                  : `${report.runsCount.toString()} ${report.runsCount > 1 ? t('reportsUi.runPlural', 'runs') : t('reportsUi.runSingular', 'run')}`}
                {formattedDates.createdAt && (
                  <>
                    , {t('reportsUi.since', 'since')} {formattedDates.createdAt}
                  </>
                )}
              </HoverCardItemValue>
            </HoverCardItem>
          </HoverCardBody>

          {buttonConfig.isGoogleSheets && (
            <HoverCardFooter>
              <Button
                className='w-full'
                variant='default'
                onClick={handleGoogleSheetOpen}
                title={t('reportsUi.openInGoogleSheets', 'Open in Google Sheets')}
                aria-label={t('reportsUi.openInGoogleSheets', 'Open in Google Sheets')}
              >
                {t('reportsUi.openInGoogleSheets', 'Open in Google Sheets')}
                <ExternalLink className='ml-1 inline h-4 w-4' aria-hidden='true' />
              </Button>
            </HoverCardFooter>
          )}
        </HoverCardContent>
      </HoverCard>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison function to prevent unnecessary re-renders
    return (
      prevProps.report.id === nextProps.report.id &&
      prevProps.report.title === nextProps.report.title &&
      prevProps.report.modifiedAt === nextProps.report.modifiedAt &&
      prevProps.report.lastRunStatus === nextProps.report.lastRunStatus &&
      prevProps.report.lastRunDate === nextProps.report.lastRunDate &&
      prevProps.report.lastRunError === nextProps.report.lastRunError &&
      prevProps.report.runsCount === nextProps.report.runsCount &&
      prevProps.report.createdAt === nextProps.report.createdAt &&
      JSON.stringify(prevProps.report.destinationConfig) ===
        JSON.stringify(nextProps.report.destinationConfig)
    );
  }
);
