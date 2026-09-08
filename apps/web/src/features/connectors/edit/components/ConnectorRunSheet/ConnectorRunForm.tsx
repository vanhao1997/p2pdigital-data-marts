import { Button } from '@owox/ui/components/button';
import { Input } from '@owox/ui/components/input';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { ConnectorDefinitionConfig } from '../../../../data-marts/edit';
import { useCallback, useEffect, useId, useState } from 'react';
import { useConnector } from '../../../shared/model/hooks/useConnector';
import { RunType } from '../../../shared/enums/run-type.enum';
import { ConnectorSpecificationAttribute } from '../../../shared/enums/connector-specification-attribute.enum';
import {
  AppForm,
  Form,
  FormActions,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormLayout,
  FormMessage,
  FormRadioGroup,
  FormSection,
} from '@owox/ui/components/form';
import type { ConnectorRunFormData } from '../../../shared/model/types/connector';
import { RequiredType } from '../../../shared/api';
import { useDataMartContext } from '../../../../data-marts/edit/model';
import { ConnectorStateSection } from './ConnectorStateSection';
import { localizeConnectorSpecification } from '../../../shared/utils/connector-metadata';

interface ConnectorRunFormProps {
  configuration: ConnectorDefinitionConfig | null;
  onClose?: () => void;
  onSubmit?: (data: ConnectorRunFormData) => void;
}

export function ConnectorRunForm({ configuration, onClose, onSubmit }: ConnectorRunFormProps) {
  const { t } = useTranslation();
  const [loadedSpecifications, setLoadedSpecifications] = useState<Set<string>>(new Set());
  const formId = useId();
  const form = useForm<ConnectorRunFormData>({
    defaultValues: {
      runType: RunType.INCREMENTAL,
    },
  });

  const { loading, loadingSpecification, connectorSpecification, fetchConnectorSpecification } =
    useConnector();

  const { dataMart } = useDataMartContext();

  const loadSpecificationSafely = useCallback(
    async (connectorName: string) => {
      if (!loadedSpecifications.has(connectorName) && !loadingSpecification) {
        setLoadedSpecifications(prev => new Set(prev).add(connectorName));
        await fetchConnectorSpecification(connectorName);
      }
    },
    [loadedSpecifications, loadingSpecification, fetchConnectorSpecification]
  );

  useEffect(() => {
    if (configuration?.connector.source.name) {
      void loadSpecificationSafely(configuration.connector.source.name);
    }
  }, [configuration, loading, loadSpecificationSafely]);

  const handleSubmit = (data: ConnectorRunFormData) => {
    if (onSubmit) {
      onSubmit(data);
    }
  };

  const handleCancel = () => {
    if (onClose) {
      onClose();
    }
  };

  const getInputType = (requiredType: RequiredType | undefined) => {
    if (!requiredType) {
      return 'text';
    }
    switch (requiredType) {
      case RequiredType.DATE:
        return 'date';
      case RequiredType.NUMBER:
        return 'number';
      default:
        return 'text';
    }
  };

  if (loadingSpecification) {
    return <div>{t('common.loading')}</div>;
  }

  if (!connectorSpecification) {
    return <div>{t('connectorRun.noSpecification')}</div>;
  }

  return (
    <Form {...form}>
      <AppForm id={formId} noValidate onSubmit={e => void form.handleSubmit(handleSubmit)(e)}>
        <FormLayout>
          <FormSection title={t('common.general')}>
            <FormField
              control={form.control}
              name='runType'
              render={({ field }) => (
                <FormItem>
                  <FormLabel tooltip={t('connectorRun.runTypeTooltip')}>
                    {t('connectorRun.runType')}
                  </FormLabel>
                  <FormControl>
                    <>
                      <FormRadioGroup
                        options={[
                          { value: RunType.INCREMENTAL, label: t('connectorRun.incrementalLoad') },
                          {
                            value: RunType.MANUAL_BACKFILL,
                            label: t('connectorRun.manualBackfill'),
                          },
                        ]}
                        value={field.value}
                        onChange={field.onChange}
                        orientation='horizontal'
                      />
                      <FormDescription>
                        {form.watch('runType') === RunType.MANUAL_BACKFILL
                          ? t('connectorRun.manualBackfillDescription')
                          : t('connectorRun.incrementalDescription')}
                      </FormDescription>
                    </>
                  </FormControl>
                </FormItem>
              )}
            />

            {form.watch('runType') === RunType.INCREMENTAL && (
              <ConnectorStateSection
                configuration={configuration}
                connectorState={dataMart?.connectorState ?? null}
              />
            )}
          </FormSection>
          {form.watch('runType') === RunType.MANUAL_BACKFILL && (
            <FormSection title={t('connectorRun.runConfiguration')}>
              {connectorSpecification
                .filter(field =>
                  field.attributes?.includes(ConnectorSpecificationAttribute.MANUAL_BACKFILL)
                )
                .map(rawConnectorField => {
                  const connectorField = localizeConnectorSpecification(rawConnectorField);
                  return (
                    <FormField
                      key={connectorField.name}
                      control={form.control}
                      name={`data.${connectorField.name}`}
                      render={() => (
                        <FormItem>
                          <FormLabel tooltip={connectorField.description}>
                            {connectorField.title ?? connectorField.name}
                          </FormLabel>
                          <FormControl>
                            <Input
                              id={connectorField.name}
                              placeholder={connectorField.description}
                              type={getInputType(connectorField.requiredType)}
                              defaultValue={
                                typeof connectorField.default === 'string' ||
                                typeof connectorField.default === 'number'
                                  ? connectorField.default.toString()
                                  : undefined
                              }
                              {...form.register(`data.${connectorField.name}`, {
                                required: true,
                              })}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  );
                })}
            </FormSection>
          )}
        </FormLayout>
        <FormActions>
          <Button type='submit' disabled={!form.formState.isValid || loadingSpecification}>
            {t('common.run')}
          </Button>
          <Button type='button' variant='outline' onClick={handleCancel}>
            {t('common.cancel')}
          </Button>
        </FormActions>
      </AppForm>
    </Form>
  );
}
