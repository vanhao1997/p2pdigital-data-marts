import RelativeTime from '@owox/ui/components/common/relative-time';
import {
  SwitchItemCard,
  SwitchItemCardChevronRight,
  SwitchItemCardContent,
  SwitchItemCardDescription,
  SwitchItemCardTitle,
  SwitchItemCardToggle,
} from '@owox/ui/components/common/switch-item-card';
import { type ComponentPropsWithoutRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { DataDestination } from '../../../../../data-destination/shared/model/types';
import { ReportStatusEnum } from '../../../shared/enums/report-status.enum';
import type { DataMartReport } from '../../../shared/model/types/data-mart-report';
import { useLookerStudioReport } from './hooks/useLookerStudioReport';
import { getOperationalErrorDisplayMessage } from '../../../../../../shared/utils/localize-operational-error';

interface LookerStudioReportCardProps extends ComponentPropsWithoutRef<'div'> {
  destination: DataDestination;
  onEditReport: (report: DataMartReport) => void;
}

export function LookerStudioReportCard({
  destination,
  onEditReport,
  ...props
}: LookerStudioReportCardProps) {
  const { t } = useTranslation();
  const { existingReport, isLoading, isEnabled, isChecked, dynamicTitle, handleSwitchChange } =
    useLookerStudioReport(destination);

  const handleCardClick = useCallback(() => {
    if (existingReport) {
      onEditReport(existingReport);
    }
  }, [existingReport, onEditReport]);

  return (
    <SwitchItemCard
      className={existingReport ? 'cursor-pointer dark:hover:bg-white/5' : ''}
      onClick={existingReport ? handleCardClick : undefined}
      {...props}
    >
      <SwitchItemCardToggle
        checked={isChecked}
        disabled={!isEnabled}
        loading={isLoading}
        onCheckedChange={checked => void handleSwitchChange(checked)}
        tooltipTextSwitchOn={t('reportsUi.lookerStudioCard.removeAccess')}
        tooltipTextSwitchOff={t('reportsUi.lookerStudioCard.enableAccess')}
        tooltipTextSwitchDisabled={t('reportsUi.lookerStudioCard.publishFirst')}
      />

      <SwitchItemCardContent>
        <SwitchItemCardTitle>{dynamicTitle}</SwitchItemCardTitle>
        <SwitchItemCardDescription>
          {isChecked && existingReport ? (
            <>
              {existingReport.lastRunDate ? (
                <>
                  {t('reportsUi.lookerStudioCard.lastFetched')}{' '}
                  {existingReport.lastRunStatus === ReportStatusEnum.SUCCESS &&
                    `${t('reportsUi.lookerStudioCard.successfully')} `}
                  <RelativeTime date={new Date(existingReport.lastRunDate)} />
                  {(existingReport.lastRunStatus === ReportStatusEnum.ERROR ||
                    existingReport.lastRunStatus === ReportStatusEnum.RESTRICTED) &&
                    ` ${t('reportsUi.lookerStudioCard.failedWithError')}`}
                  {existingReport.lastRunError &&
                    getOperationalErrorDisplayMessage(existingReport.lastRunError) && (
                      <div className='mt-1 text-red-600 dark:text-red-400'>
                        {getOperationalErrorDisplayMessage(existingReport.lastRunError)}
                      </div>
                    )}
                </>
              ) : (
                t('reportsUi.lookerStudioCard.waitingForFetch')
              )}
            </>
          ) : (
            t('reportsUi.lookerStudioCard.enableAccess')
          )}
        </SwitchItemCardDescription>
      </SwitchItemCardContent>

      {isChecked && existingReport && <SwitchItemCardChevronRight />}
    </SwitchItemCard>
  );
}
