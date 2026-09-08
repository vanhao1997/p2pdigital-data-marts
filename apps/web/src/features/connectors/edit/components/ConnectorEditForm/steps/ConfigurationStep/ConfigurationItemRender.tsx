import { AppWizardStepLabel, AppWizardStepItem } from '@owox/ui/components/common/wizard';
import { RequiredType, type ConnectorSpecificationResponseApiDto } from '../../../../../shared/api';
import { configurationFieldRender } from './ConfigurationFieldRender';
import { Button } from '@owox/ui/components/button';
import { VariablePicker } from './VariablePicker';
import { localizeConnectorSpecification } from '../../../../../shared/utils/connector-metadata';
import { useTranslation } from 'react-i18next';

interface ConfigurationItemRenderProps {
  specification: ConnectorSpecificationResponseApiDto;
  configuration: Record<string, unknown>;
  isEditingExisting: boolean;
  isSecret: boolean;
  isSecretEditing: boolean;
  onValueChange: (name: string, value: unknown) => void;
  onSecretEditToggle: (name: string, enable: boolean) => void;
  connectorName: string;
}

export function ConfigurationItemRender({
  specification,
  configuration,
  isEditingExisting,
  isSecretEditing,
  isSecret,
  onValueChange,
  onSecretEditToggle,
  connectorName,
}: ConfigurationItemRenderProps) {
  const { t } = useTranslation();
  const localizedSpecification = localizeConnectorSpecification(specification);
  return (
    <AppWizardStepItem key={localizedSpecification.name}>
      {localizedSpecification.requiredType !== RequiredType.BOOLEAN && (
        <div className='flex items-center justify-between'>
          <AppWizardStepLabel
            htmlFor={localizedSpecification.name}
            required={localizedSpecification.required}
            tooltip={localizedSpecification.description}
          >
            {localizedSpecification.title ?? localizedSpecification.name}
          </AppWizardStepLabel>
          {isSecret && isEditingExisting && (
            <Button
              variant='ghost'
              size='sm'
              type='button'
              onClick={() => {
                onSecretEditToggle(localizedSpecification.name, !isSecretEditing);
              }}
            >
              {isSecretEditing ? t('common.cancel') : t('common.edit')}
            </Button>
          )}
          {localizedSpecification.requiredType !== RequiredType.OBJECT && !isSecret && (
            <VariablePicker
              connectorName={connectorName}
              kind='value'
              value={configuration[localizedSpecification.name]}
              onSelect={variableId => {
                onValueChange(
                  localizedSpecification.name,
                  variableId ? { _variable_id: variableId } : ''
                );
              }}
            />
          )}
        </div>
      )}

      {configurationFieldRender({
        specification: localizedSpecification,
        configuration,
        onValueChange: onValueChange,
        flags: {
          isSecret,
          isEditingExisting,
          isSecretEditing,
        },
        connectorName: connectorName,
      })}
    </AppWizardStepItem>
  );
}
