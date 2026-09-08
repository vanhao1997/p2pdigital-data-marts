import { Input } from '@owox/ui/components/input';
import type { ConnectorSpecificationResponseApiDto } from '../../../../../../shared/api/types';
import { useTranslation } from 'react-i18next';

interface ConfigurationStringFieldProps {
  specification: ConnectorSpecificationResponseApiDto;
  configuration: Record<string, unknown>;
  onValueChange: (name: string, value: unknown) => void;
}

export function ConfigurationStringField({
  specification,
  configuration,
  onValueChange,
}: ConfigurationStringFieldProps) {
  const { t } = useTranslation();
  const { name, placeholder } = specification;
  const displayName = specification.title ?? specification.name;

  const marker = configuration[name];
  const markerValue =
    marker && typeof marker === 'object' && !Array.isArray(marker)
      ? Object.values(marker as Record<string, unknown>)[0]
      : undefined;
  const displayValue =
    typeof markerValue === 'string'
      ? t('connectorWizard.savedVariable')
      : typeof marker === 'string'
        ? marker
        : '';
  return (
    <Input
      id={name}
      name={name}
      type='text'
      value={displayValue}
      readOnly={Boolean(marker && typeof marker === 'object')}
      placeholder={placeholder ?? t('connectorWizard.enterValue', { name: displayName })}
      onChange={e => {
        onValueChange(name, e.target.value);
      }}
    />
  );
}
