import { QueryClientContext, useQuery } from '@tanstack/react-query';
import { useInRouterContext, useParams } from 'react-router';
import { useContext } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@owox/ui/components/select';
import { configurationVariablesApi } from '../../../../../../configuration-variables';
import type { ConfigurationVariableKind } from '../../../../../../configuration-variables';
import { useTranslation } from 'react-i18next';

interface VariablePickerProps {
  connectorName?: string;
  kind: ConfigurationVariableKind;
  value?: unknown;
  onSelect: (variableId: string | null) => void;
}

function markerId(value: unknown, kind: ConfigurationVariableKind): string | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const key =
    kind === 'value'
      ? '_variable_id'
      : kind === 'secret_reference'
        ? '_secrets_variable_id'
        : '_credential_variable_id';
  const id = (value as Record<string, unknown>)[key];
  return typeof id === 'string' ? id : undefined;
}

export function VariablePicker({ connectorName, kind, value, onSelect }: VariablePickerProps) {
  // ConfigurationStep is also rendered in isolated form tests and story-like
  // contexts without the application router/auth providers. Keep the picker
  // inert there while retaining the normal query-backed behavior in-app.
  const queryClient = useContext(QueryClientContext);
  if (!useInRouterContext() || !queryClient) return null;

  return (
    <VariablePickerInRouter
      connectorName={connectorName}
      kind={kind}
      value={value}
      onSelect={onSelect}
    />
  );
}

function VariablePickerInRouter({ connectorName, kind, value, onSelect }: VariablePickerProps) {
  const { t } = useTranslation();
  const { projectId } = useParams<{ projectId?: string }>();
  const query = useQuery({
    queryKey: ['configuration-variables', projectId],
    queryFn: () => configurationVariablesApi.list(),
    enabled: Boolean(projectId),
  });
  const variables = (query.data ?? []).filter(variable => {
    if (variable.kind !== kind) return false;
    return !connectorName || !variable.connectorName || variable.connectorName === connectorName;
  });
  const selected = markerId(value, kind);

  if (query.isLoading || variables.length === 0) return null;

  return (
    <Select
      value={selected ?? '__manual__'}
      onValueChange={next => {
        onSelect(next === '__manual__' ? null : next);
      }}
    >
      <SelectTrigger
        className='h-8 w-auto min-w-32 text-xs'
        aria-label={t('variablePicker.useSavedVariable')}
      >
        <SelectValue placeholder={t('variablePicker.useVariable')} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value='__manual__'>{t('variablePicker.manualValue')}</SelectItem>
        {variables.map(variable => (
          <SelectItem key={variable.id} value={variable.id}>
            {variable.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
