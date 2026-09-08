import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@owox/ui/components/sheet';
import type { DataStorageType } from '../../../../data-storage';
import { ConnectorEditForm } from '../ConnectorEditForm/ConnectorEditForm';
import type { ConnectorConfig } from '../../../../data-marts/edit';
import { UnsavedChangesConfirmationDialog } from '../../../../../shared/components/UnsavedChangesConfirmationDialog';
import { useUnsavedGuard } from '../../../../../hooks/useUnsavedGuard';
import { useIntercomLauncher } from '../../../../../shared/hooks/useIntercomLauncher';
import { useTranslation } from 'react-i18next';

interface ConnectorEditSheetProps {
  isOpen: boolean;
  onClose: () => void;
  dataStorageType: DataStorageType;
  onSubmit: (configuredConnector: ConnectorConfig) => void;
  configurationOnly?: boolean;
  existingConnector?: ConnectorConfig | null;
  mode?: 'full' | 'configuration-only' | 'fields-only';
  initialStep?: number;
  preselectedConnector?: string | null;
}

export function ConnectorEditSheet({
  isOpen,
  onClose,
  dataStorageType,
  onSubmit,
  configurationOnly = false,
  existingConnector = null,
  mode = 'full',
  initialStep,
  preselectedConnector,
}: ConnectorEditSheetProps) {
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
            {mode === 'fields-only'
              ? t('connectorWizard.connectorFields', 'Connector fields')
              : existingConnector?.source.name
                ? t('connectorWizard.editConnector', 'Edit connector')
                : t('connectorWizard.setup', 'Set up connector')}
          </SheetTitle>
          <SheetDescription>
            {mode === 'fields-only'
              ? t('connectorWizard.selectFieldsForDataMart', 'Select fields for your Data Mart')
              : existingConnector?.source.name
                ? t('connectorWizard.updateConfiguration', 'Update configuration')
                : t('connectorWizard.followSetupSteps', 'Follow these steps to set it up')}
          </SheetDescription>
        </SheetHeader>
        <ConnectorEditForm
          onSubmit={configuredConnector => {
            onSubmit(configuredConnector);
            handleFormSubmitSuccess();
          }}
          dataStorageType={dataStorageType}
          configurationOnly={configurationOnly || mode === 'configuration-only'}
          existingConnector={existingConnector}
          mode={mode}
          initialStep={initialStep}
          preselectedConnector={preselectedConnector}
          onDirtyChange={handleFormDirtyChange}
          isOpen={isOpen}
        />
        <UnsavedChangesConfirmationDialog
          open={showUnsavedDialog}
          onOpenChange={setShowUnsavedDialog}
          onConfirm={confirmClose}
        />
      </SheetContent>
    </Sheet>
  );
}
