import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@owox/ui/components/command';
import { Popover, PopoverContent, PopoverTrigger } from '@owox/ui/components/popover';
import { ArrowLeft, Check, Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../../shared/components/Button';
import type { DataQualitySelectableField } from '../model/data-quality.model';

interface DataQualityFieldPickerProps {
  fields: DataQualitySelectableField[];
  disabled: boolean;
  onAdd: (ruleKey: string) => void;
  initialFieldPathKey?: string;
  triggerLabel?: string;
}

export function DataQualityFieldPicker({
  fields,
  disabled,
  onAdd,
  initialFieldPathKey,
  triggerLabel,
}: DataQualityFieldPickerProps) {
  const { t } = useTranslation();
  const resolvedTriggerLabel = triggerLabel ?? t('dataQualityUi.addChecks');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFieldPathKey, setSelectedFieldPathKey] = useState(initialFieldPathKey ?? '');
  const selectedField = fields.find(field => field.fieldPathKey === selectedFieldPathKey);

  const setOpen = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      setSelectedFieldPathKey(initialFieldPathKey ?? '');
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type='button'
          variant='outline'
          size='sm'
          disabled={disabled}
          aria-label={resolvedTriggerLabel}
        >
          <Plus className='size-4' aria-hidden='true' />
          {!initialFieldPathKey && resolvedTriggerLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align='end'
        className='w-[min(24rem,calc(100vw-2rem))] p-0'
        aria-label={t('dataQualityUi.addFieldCheck')}
      >
        {selectedField ? (
          <CheckStep
            field={selectedField}
            onBack={() => {
              setSelectedFieldPathKey('');
            }}
            onAdd={ruleKey => {
              onAdd(ruleKey);
              setIsOpen(false);
            }}
          />
        ) : (
          <FieldStep fields={fields} onSelect={setSelectedFieldPathKey} />
        )}
      </PopoverContent>
    </Popover>
  );
}

function FieldStep({
  fields,
  onSelect,
}: {
  fields: DataQualitySelectableField[];
  onSelect: (fieldPathKey: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <Command>
      <CommandInput placeholder={t('dataQualityUi.searchFields')} autoFocus />
      <CommandList>
        <CommandEmpty>{t('dataQualityUi.noFields')}</CommandEmpty>
        <CommandGroup heading={t('dataQualityUi.chooseField')}>
          {fields.map(field => (
            <CommandItem
              key={field.fieldPathKey}
              value={`${field.label} ${field.type ?? ''} ${field.fieldPathKey}`}
              onSelect={() => {
                onSelect(field.fieldPathKey);
              }}
            >
              {field.type && (
                <span className='bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-xs'>
                  {field.type}
                </span>
              )}
              <span className='min-w-0 flex-1 truncate'>{field.label}</span>
              {field.checks.filter(check => check.isAdded).length > 0 && (
                <span className='text-muted-foreground text-xs'>
                  {t('dataQualityUi.addedCount', {
                    count: field.checks.filter(check => check.isAdded).length,
                  })}
                </span>
              )}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

function CheckStep({
  field,
  onBack,
  onAdd,
}: {
  field: DataQualitySelectableField;
  onBack: () => void;
  onAdd: (ruleKey: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <Command>
      <div className='flex items-center gap-2 border-b px-2 py-2'>
        <Button
          type='button'
          variant='ghost'
          size='sm'
          aria-label={t('dataQualityUi.chooseAnotherField')}
          onClick={onBack}
        >
          <ArrowLeft className='size-4' aria-hidden='true' />
        </Button>
        <div className='min-w-0'>
          <p className='truncate text-sm font-medium'>{field.label}</p>
          <p className='text-muted-foreground text-xs'>{t('dataQualityUi.chooseCheck')}</p>
        </div>
        {field.type && (
          <span className='bg-muted text-muted-foreground ml-auto rounded px-1.5 py-0.5 text-xs'>
            {field.type}
          </span>
        )}
      </div>
      <CommandList>
        <CommandGroup>
          {field.checks.map(check => (
            <CommandItem
              key={check.key}
              value={`${check.label}${check.isAdded ? ' Added' : ''}`}
              disabled={check.isAdded}
              onSelect={() => {
                if (!check.isAdded) onAdd(check.key);
              }}
            >
              <span className='min-w-0 flex-1'>
                <span className='block text-sm font-medium'>{check.label}</span>
                <span className='text-muted-foreground block text-xs break-words whitespace-normal'>
                  {check.description}
                </span>
              </span>
              {check.isAdded && (
                <span className='text-muted-foreground inline-flex items-center gap-1 text-xs'>
                  <Check className='size-3' aria-hidden='true' />
                  {t('dataQualityUi.added')}
                </span>
              )}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
