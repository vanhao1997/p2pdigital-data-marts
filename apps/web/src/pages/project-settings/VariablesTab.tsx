import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, KeyRound, Plus, Trash2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@owox/ui/components/alert';
import { Button } from '@owox/ui/components/button';
import { Input } from '@owox/ui/components/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@owox/ui/components/select';
import { useIsAdmin } from '../../features/idp/hooks/useRole';
import { useProjectRoute } from '../../shared/hooks';
import { configurationVariablesApi } from '../../features/configuration-variables';
import type { ConfigurationVariableKind } from '../../features/configuration-variables';

const variablesKey = (projectId: string) => ['configuration-variables', projectId] as const;
const candidatesKey = (projectId: string) =>
  ['configuration-variable-candidates', projectId] as const;

export function VariablesTab() {
  const { t } = useTranslation();
  const { projectId } = useProjectRoute();
  const projectKey = projectId ?? '';
  const isAdmin = useIsAdmin();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState<ConfigurationVariableKind>('value');
  const [credentialId, setCredentialId] = useState('');

  const variablesQuery = useQuery({
    queryKey: variablesKey(projectKey),
    queryFn: () => configurationVariablesApi.list(),
    enabled: Boolean(projectId),
  });
  const candidatesQuery = useQuery({
    queryKey: candidatesKey(projectKey),
    queryFn: () => configurationVariablesApi.listCandidates(),
    enabled: Boolean(projectId) && isAdmin,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      configurationVariablesApi.create({
        name: name.trim(),
        kind,
        ...(kind === 'value' ? { value } : { credentialId }),
        ...(description.trim() ? { description: description.trim() } : {}),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: variablesKey(projectKey) });
      setName('');
      setValue('');
      setDescription('');
      setCredentialId('');
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => configurationVariablesApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: variablesKey(projectKey) });
    },
  });

  const candidates = useMemo(() => candidatesQuery.data ?? [], [candidatesQuery.data]);

  if (variablesQuery.isLoading)
    return <div className='text-muted-foreground p-4 text-sm'>{t('variablesPage.loading')}</div>;
  if (variablesQuery.isError) {
    return (
      <Alert variant='destructive'>
        <AlertCircle className='h-4 w-4' />
        <AlertTitle>{t('variablesPage.loadFailed')}</AlertTitle>
        <AlertDescription className='flex items-center gap-3'>
          {variablesQuery.error instanceof Error
            ? variablesQuery.error.message
            : t('variablesPage.requestFailed')}
          <Button size='sm' variant='outline' onClick={() => void variablesQuery.refetch()}>
            {t('common.retry', 'Retry')}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className='flex flex-col gap-5'>
      <div className='bg-card rounded-md border p-4'>
        <div className='mb-1 flex items-center gap-2 font-medium'>
          <KeyRound className='h-4 w-4' />
          {t('variablesPage.title')}
        </div>
        <p className='text-muted-foreground mb-4 text-sm'>{t('variablesPage.description')}</p>
        {isAdmin && (
          <div className='grid gap-3 md:grid-cols-2'>
            <Input
              placeholder={t('variablesPage.namePlaceholder')}
              value={name}
              onChange={event => {
                setName(event.target.value);
              }}
            />
            <Select
              value={kind}
              onValueChange={next => {
                setKind(next as ConfigurationVariableKind);
                setCredentialId('');
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('variablesPage.typePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='value'>{t('variablesPage.valueType')}</SelectItem>
                <SelectItem value='secret_reference'>
                  {t('variablesPage.secretReference')}
                </SelectItem>
                <SelectItem value='credential_reference'>
                  {t('variablesPage.credentialReference')}
                </SelectItem>
              </SelectContent>
            </Select>
            {kind === 'value' ? (
              <Input
                placeholder={t('variablesPage.valuePlaceholder')}
                value={value}
                onChange={event => {
                  setValue(event.target.value);
                }}
              />
            ) : (
              <Select value={credentialId} onValueChange={setCredentialId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('variablesPage.credentialPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {candidates
                    .filter(candidate => candidate.kind === kind)
                    .map(candidate => (
                      <SelectItem key={candidate.id} value={candidate.id}>
                        {candidate.connectorName} ·{' '}
                        {candidate.identity?.email ??
                          candidate.identity?.name ??
                          candidate.id.slice(0, 8)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
            <Input
              placeholder={t('variablesPage.descriptionPlaceholder')}
              value={description}
              onChange={event => {
                setDescription(event.target.value);
              }}
            />
            <Button
              className='md:col-span-2 md:w-fit'
              disabled={
                !name.trim() ||
                (kind === 'value' ? !value : !credentialId) ||
                createMutation.isPending
              }
              onClick={() => {
                void createMutation.mutateAsync();
              }}
            >
              <Plus className='h-4 w-4' />
              {t('variablesPage.save')}
            </Button>
          </div>
        )}
        {createMutation.isError && (
          <p className='text-destructive mt-2 text-sm'>
            {createMutation.error instanceof Error
              ? createMutation.error.message
              : t('variablesPage.saveFailed')}
          </p>
        )}
      </div>

      <div className='overflow-hidden rounded-md border'>
        {(variablesQuery.data ?? []).length === 0 ? (
          <div className='text-muted-foreground p-8 text-center text-sm'>
            {t('variablesPage.empty')}
          </div>
        ) : (
          <div className='divide-y'>
            {(variablesQuery.data ?? []).map(variable => (
              <div key={variable.id} className='flex items-center justify-between gap-4 p-4'>
                <div className='min-w-0'>
                  <div className='font-medium'>{variable.name}</div>
                  <div className='text-muted-foreground text-sm'>
                    {variable.kind}
                    {variable.connectorName ? ` · ${variable.connectorName}` : ''}
                    {variable.description ? ` · ${variable.description}` : ''}
                  </div>
                  {variable.kind === 'value' && (
                    <div className='text-sm'>{String(variable.value ?? '')}</div>
                  )}
                </div>
                {isAdmin && (
                  <Button
                    variant='ghost'
                    size='icon'
                    aria-label={`Delete ${variable.name}`}
                    disabled={deleteMutation.isPending}
                    onClick={() => {
                      if (window.confirm(`Delete variable ${variable.name}?`))
                        void deleteMutation.mutateAsync(variable.id);
                    }}
                  >
                    <Trash2 className='text-destructive h-4 w-4' />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default VariablesTab;
