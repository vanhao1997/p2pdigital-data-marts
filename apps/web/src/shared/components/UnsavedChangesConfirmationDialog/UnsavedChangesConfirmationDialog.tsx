import { ConfirmationDialog } from '../ConfirmationDialog';
import { useTranslation } from 'react-i18next';

/**
 * Standard "exit without saving?" confirmation for sheet forms with unsaved changes.
 *
 * Render *inside* the sheet's `SheetContent` (not as a sibling of `Sheet`) so Radix treats
 * it as a nested dismissable layer — interacting with the dialog then does not dismiss
 * the host sheet (which previously re-opened the dialog and trapped the user in a loop).
 */
interface UnsavedChangesConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function UnsavedChangesConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
}: UnsavedChangesConfirmationDialogProps) {
  const { t } = useTranslation();

  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('common.unsavedChangesTitle', 'Unsaved Changes')}
      description={t(
        'common.unsavedChangesDescription',
        'You have unsaved changes. Exit without saving?'
      )}
      confirmLabel={t('common.leaveWithoutSaving', 'Yes, leave now')}
      cancelLabel={t('common.stayOnPage', 'No, stay here')}
      onConfirm={onConfirm}
      variant='destructive'
    />
  );
}

export type { UnsavedChangesConfirmationDialogProps };
