import { Input } from '@owox/ui/components/input';
import type { ConnectorSpecificationResponseApiDto } from '../../../../../../shared/api/types';
import { SECRET_MASK } from '../../../../../../../../shared/constants/secrets';
import type { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';

interface ConfigurationSecretFieldProps {
  specification: ConnectorSpecificationResponseApiDto;
  configuration: Record<string, unknown>;
  onValueChange: (name: string, value: unknown) => void;
  isEditingExisting: boolean;
  isSecretEditing: boolean;
}

export function ConfigurationSecretField({
  specification,
  configuration,
  onValueChange,
  isEditingExisting,
  isSecretEditing,
}: ConfigurationSecretFieldProps) {
  const { t } = useTranslation();
  const displayName = specification.title ?? specification.name;
  const isReadonly = isEditingExisting && !isSecretEditing;

  const marker = configuration[specification.name];
  const isVariableReference = Boolean(
    marker && typeof marker === 'object' && !Array.isArray(marker)
  );
  return (
    <Input
      id={specification.name}
      {...(!isReadonly ? { name: specification.name } : {})}
      type={isReadonly || isVariableReference ? 'password' : 'text'}
      autoComplete={isReadonly ? 'new-password' : 'off'}
      autoCorrect='off'
      autoCapitalize='off'
      spellCheck={false}
      value={
        isReadonly || isVariableReference
          ? SECRET_MASK
          : (configuration[specification.name] as string) || ''
      }
      {...(isReadonly || isVariableReference ? { readOnly: true, disabled: true } : {})}
      {...(!isReadonly
        ? {
            placeholder:
              specification.placeholder ?? t('connectorWizard.enterValue', { name: displayName }),
          }
        : {})}
      {...(!isReadonly
        ? {
            onChange: (e: ChangeEvent<HTMLInputElement>) => {
              onValueChange(specification.name, e.target.value);
            },
          }
        : {})}
    />
  );
}
