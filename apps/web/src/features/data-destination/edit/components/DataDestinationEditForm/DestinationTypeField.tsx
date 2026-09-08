import { type UseFormReturn } from 'react-hook-form';
import { type DataDestinationFormData, DataDestinationType } from '../../../shared';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@owox/ui/components/select';
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from '@owox/ui/components/form';
import { Badge } from '@owox/ui/components/badge';
import DestinationTypeDescription from './FormDescriptions/DestinationTypeDescription';
import {
  DataDestinationTypeModel,
  DataDestinationStatus,
  canCreateDestinationInApp,
} from '../../../shared';
import { useTranslation } from 'react-i18next';

interface DestinationTypeFieldProps {
  form: UseFormReturn<DataDestinationFormData>;
  isEditMode?: boolean;
  allowedDestinationTypes?: DataDestinationType[];
}

export function DestinationTypeField({
  form,
  isEditMode,
  allowedDestinationTypes,
}: DestinationTypeFieldProps) {
  const { t } = useTranslation();
  return (
    <FormField
      control={form.control}
      name='type'
      render={({ field }) => (
        <FormItem>
          <FormLabel tooltip={t('destinationForm.destinationTypeTooltip')}>
            {t('formCommon.destinationType')}
          </FormLabel>
          <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!!isEditMode}>
            <FormControl>
              <SelectTrigger className='w-full'>
                <SelectValue placeholder={t('destinationForm.destinationTypePlaceholder')} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              <SelectGroup>
                {DataDestinationTypeModel.getAllTypes()
                  .filter(({ type }) =>
                    allowedDestinationTypes && allowedDestinationTypes.length > 0
                      ? allowedDestinationTypes.includes(type)
                      : true
                  )
                  // A type nobody sets up by hand is still listed while it is the one selected,
                  // or editing such a destination would show an empty type field.
                  .filter(({ type }) => type === field.value || canCreateDestinationInApp(type))
                  .map(({ type, displayName, icon: Icon, status }) => {
                    const isComingSoon = status === DataDestinationStatus.COMING_SOON;
                    return (
                      <SelectItem key={type} value={type} disabled={isComingSoon}>
                        <div className='flex items-center gap-2'>
                          <Icon size={18} />
                          {displayName}
                          {isComingSoon && <Badge variant='outline'>{status}</Badge>}
                        </div>
                      </SelectItem>
                    );
                  })}
              </SelectGroup>
            </SelectContent>
          </Select>
          <FormDescription>
            <DestinationTypeDescription destinationType={field.value} />
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
