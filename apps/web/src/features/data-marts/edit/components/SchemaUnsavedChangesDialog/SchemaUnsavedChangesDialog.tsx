import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@owox/ui/components/alert-dialog';
import { Button } from '@owox/ui/components/button';
import type { SchemaGuardIntent } from '../../model';
import { useTranslation } from 'react-i18next';

interface SchemaUnsavedChangesDialogProps {
  open: boolean;
  intent: SchemaGuardIntent;
  changeLabel?: string;
  isSaving?: boolean;
  errorMessage?: string | null;
  onSaveAndContinue: () => void;
  onDiscardAndContinue: () => void;
  onCancel: () => void;
}

const DESCRIPTION_KEYS: Record<SchemaGuardIntent, string> = {
  ai: 'schemaUnsavedChanges.ai',
  refresh: 'schemaUnsavedChanges.refresh',
  publish: 'schemaUnsavedChanges.publish',
  definition: 'schemaUnsavedChanges.definition',
  navigation: 'schemaUnsavedChanges.navigation',
};

export function SchemaUnsavedChangesDialog({
  open,
  intent,
  changeLabel = 'schema',
  isSaving = false,
  errorMessage = null,
  onSaveAndContinue,
  onDiscardAndContinue,
  onCancel,
}: SchemaUnsavedChangesDialogProps) {
  const { t } = useTranslation();
  const verb =
    intent === 'navigation' ? t('schemaUnsavedChanges.leave') : t('schemaUnsavedChanges.continue');
  const isSchemaChange = changeLabel === 'schema';
  const description =
    intent === 'navigation'
      ? t('schemaUnsavedChanges.navigation', { changeLabel })
      : isSchemaChange
        ? t(DESCRIPTION_KEYS[intent])
        : t('schemaUnsavedChanges.continueDescription', { changeLabel });
  return (
    <AlertDialog
      open={open}
      onOpenChange={isOpen => {
        // While a save is in flight the buttons are disabled; keep Escape /
        // outside-click from cancelling too, which would drop the pending
        // follow-up action even though the schema is being persisted.
        if (!isOpen && !isSaving) {
          onCancel();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('schemaUnsavedChanges.title', { changeLabel })}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {errorMessage && (
          <p
            role='alert'
            className='border-destructive/40 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-sm'
          >
            {errorMessage}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSaving}>{t('common.cancel')}</AlertDialogCancel>
          <Button
            type='button'
            variant='outline'
            onClick={onDiscardAndContinue}
            disabled={isSaving}
          >
            {t('schemaUnsavedChanges.discardAnd', { verb })}
          </Button>
          <Button type='button' onClick={onSaveAndContinue} disabled={isSaving}>
            {t('schemaUnsavedChanges.saveAnd', { verb })}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export type { SchemaUnsavedChangesDialogProps };
