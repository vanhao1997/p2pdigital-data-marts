import { Input } from '@owox/ui/components/input';
import type { ConnectorSpecificationResponseApiDto } from '../../../../../../shared/api/types';
import { useTranslation } from 'react-i18next';

interface ConfigurationNumberFieldProps {
  specification: ConnectorSpecificationResponseApiDto;
  configuration: Record<string, unknown>;
  onValueChange: (name: string, value: unknown) => void;
}

export function ConfigurationNumberField({
  specification,
  configuration,
  onValueChange,
}: ConfigurationNumberFieldProps) {
  const { t } = useTranslation();
  const { name, placeholder, minimum } = specification;
  const displayName = specification.title ?? specification.name;
  const value = configuration[name];
  const inputValue = typeof value === 'number' || typeof value === 'string' ? String(value) : '';

  return (
    <Input
      id={name}
      name={name}
      type='number'
      min={minimum}
      value={inputValue}
      placeholder={placeholder ?? t('connectorWizard.enterValue', { name: displayName })}
      onChange={e => {
        const value = e.target.value;
        const numValue = value === '' ? undefined : parseFloat(value);
        onValueChange(name, numValue);
      }}
    />
  );
}
