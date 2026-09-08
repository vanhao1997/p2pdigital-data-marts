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
import { useTranslation } from 'react-i18next';
import { DataMartDefinitionType } from '../../../shared';
import type { InputSourceChangeImpact } from './useInputSourceChangeImpact';

interface ChangeInputSourceTypeDialogProps {
  open: boolean;
  fromType: DataMartDefinitionType;
  toType: DataMartDefinitionType;
  impact: InputSourceChangeImpact | null;
  isLoadingImpact: boolean;
  /** The impact read failed — dependencies are unknown, not zero. */
  impactFailed: boolean;
  onRetryImpact: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}

function describeImpact(
  impact: InputSourceChangeImpact,
  t: ReturnType<typeof useTranslation>['t']
): string | null {
  const relationships = impact.inboundRelationships + impact.outboundRelationships;
  const parts: string[] = [];

  if (relationships > 0) {
    parts.push(t('inputSourceChange.relationships', { count: relationships }));
  }
  if (impact.reports > 0) {
    parts.push(t('inputSourceChange.reports', { count: impact.reports }));
  }

  if (parts.length === 0) {
    return null;
  }

  return parts.join(' and ');
}

export function ChangeInputSourceTypeDialog({
  open,
  fromType,
  toType,
  impact,
  isLoadingImpact,
  impactFailed,
  onRetryImpact,
  onConfirm,
  onCancel,
}: ChangeInputSourceTypeDialogProps) {
  const { t } = useTranslation();
  const typeLabels: Record<DataMartDefinitionType, string> = {
    [DataMartDefinitionType.SQL]: 'SQL',
    [DataMartDefinitionType.TABLE]: t('inputSourceChange.types.table'),
    [DataMartDefinitionType.VIEW]: t('inputSourceChange.types.view'),
    [DataMartDefinitionType.TABLE_PATTERN]: t('inputSourceChange.types.pattern'),
    [DataMartDefinitionType.CONNECTOR]: t('inputSourceChange.types.connector'),
  };
  const dependants = impact ? describeImpact(impact, t) : null;

  return (
    <AlertDialog
      open={open}
      onOpenChange={isOpen => {
        if (!isOpen) {
          onCancel();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('inputSourceChange.title', { from: typeLabels[fromType], to: typeLabels[toType] })}
          </AlertDialogTitle>
          <AlertDialogDescription>{t('inputSourceChange.description')}</AlertDialogDescription>
        </AlertDialogHeader>

        {/* A failed read is "unknown", never "zero": the reassuring copy is reserved for a
            successful response that actually counted nothing. */}
        {isLoadingImpact ? (
          <p className='text-muted-foreground text-sm'>{t('inputSourceChange.checking')}</p>
        ) : impactFailed ? (
          <p className='text-muted-foreground text-sm'>
            {t('inputSourceChange.failed')}{' '}
            <button type='button' className='underline underline-offset-2' onClick={onRetryImpact}>
              {t('inputSourceChange.retry')}
            </button>
            .
          </p>
        ) : impact ? (
          <p className='text-muted-foreground text-sm'>
            {dependants
              ? t('inputSourceChange.dependants', { dependants })
              : t('inputSourceChange.none')}
          </p>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <Button type='button' onClick={onConfirm}>
            {t('inputSourceChange.confirm')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export type { ChangeInputSourceTypeDialogProps };
