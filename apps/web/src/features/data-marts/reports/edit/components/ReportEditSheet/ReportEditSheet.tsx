import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@owox/ui/components/sheet';
import { UnsavedChangesConfirmationDialog } from '../../../../../../shared/components/UnsavedChangesConfirmationDialog';
import type { DataMartReport } from '../../../shared/model/types/data-mart-report.ts';
import { ReportEditForm } from '../ReportEditForm';
import { DataDestinationProvider } from '../../../../../data-destination';
import { ReportFormMode } from '../../../shared';
import type { DataDestination } from '../../../../../data-destination';
import { useUnsavedGuard } from '../../../../../../hooks/useUnsavedGuard';
import { useIntercomLauncher } from '../../../../../../shared/hooks/useIntercomLauncher';
import { ReportSheetDescription } from '../ReportSheetDescription';
import { useTranslation } from 'react-i18next';

interface ReportEditSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitSuccess?: () => void | Promise<void>;
  initialReport?: DataMartReport;
  mode: ReportFormMode;
  preSelectedDestination?: DataDestination | null;
}

export function ReportEditSheet({
  isOpen,
  onClose,
  onSubmitSuccess,
  initialReport,
  mode,
  preSelectedDestination,
}: ReportEditSheetProps) {
  const { t } = useTranslation();
  const {
    showUnsavedDialog,
    setShowUnsavedDialog,
    handleClose,
    confirmClose,
    handleFormDirtyChange,
    handleFormSubmitSuccess,
  } = useUnsavedGuard(onClose);

  useIntercomLauncher(isOpen);

  return (
    <Sheet
      open={isOpen}
      onOpenChange={open => {
        if (!open) {
          handleClose();
        }
      }}
    >
      <SheetContent>
        <SheetHeader>
          <SheetTitle>
            {mode === ReportFormMode.CREATE
              ? t('reportsUi.createNewReport', 'Tạo báo cáo mới')
              : t('reportsUi.editReportSheetTitle', 'Chỉnh sửa báo cáo')}
          </SheetTitle>
          <ReportSheetDescription mode={mode} report={initialReport}>
            {mode === ReportFormMode.CREATE
              ? t('reportsUi.createReportSheetDescription', 'Điền thông tin để tạo báo cáo mới')
              : t('reportsUi.editReportSheetDescription', 'Cập nhật thông tin của báo cáo hiện có')}
          </ReportSheetDescription>
        </SheetHeader>

        <DataDestinationProvider>
          <ReportEditForm
            initialReport={initialReport}
            mode={mode}
            onDirtyChange={handleFormDirtyChange}
            onSubmit={() => {
              void onSubmitSuccess?.();
              handleFormSubmitSuccess();
            }}
            onCancel={handleClose}
            preSelectedDestination={preSelectedDestination}
          />
        </DataDestinationProvider>
        <UnsavedChangesConfirmationDialog
          open={showUnsavedDialog}
          onOpenChange={setShowUnsavedDialog}
          onConfirm={confirmClose}
        />
      </SheetContent>
    </Sheet>
  );
}
