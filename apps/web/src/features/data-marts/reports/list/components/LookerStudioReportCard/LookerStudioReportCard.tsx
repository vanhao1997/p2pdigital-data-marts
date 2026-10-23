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
              <div
                className='mt-2 flex flex-wrap items-center gap-2'
                onClick={e => e.stopPropagation()}
              >
                <a
                  href='https://lookerstudio.google.com/reporting/ad3501fd-54fe-4519-9b7a-6f240b3c76e3/page/azjBB'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='inline-flex items-center rounded border border-primary/40 bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary hover:bg-primary/25'
                >
                  ★ Mẫu 1+2: Brand Executive & Định dạng QC (6 Trang) ↗
                </a>
                <a
                  href='https://lookerstudio.google.com/reporting/025447e8-2dbf-480e-a5e4-08b660e555f1/page/lSbMD'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='inline-flex items-center rounded border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary/20'
                >
                  ★ Mẫu 2: Porter Đa Kênh & Định dạng QC (Lọc Ngày/Kênh) ↗
                </a>
                <a
                  href='https://lookerstudio.google.com/reporting/b8d91377-7ce6-4f3c-8c56-f7824efd82fe/page/p_74wqzowrid'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='inline-flex items-center rounded border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary/20'
                >
                  ★ Mẫu 4: Coupler Zero-Spend & Định dạng Nội dung ↗
                </a>
                <a
                  href='https://lookerstudio.google.com/reporting/9f887651-1b1e-466b-9edb-3708e016b783/page/unRBG'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='inline-flex items-center rounded border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium text-foreground hover:bg-muted'
                >
                  Báo cáo OWOX Data Marts Partner Connector ↗
                </a>
              </div>
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
