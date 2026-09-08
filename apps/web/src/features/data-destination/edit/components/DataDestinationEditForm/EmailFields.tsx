import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@owox/ui/components/form';
import { Textarea } from '@owox/ui/components/textarea';
import { type UseFormReturn, type Path, type FieldPathValue } from 'react-hook-form';
import { type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type DataDestinationFormData } from '../../../shared';

const EMAILS_FIELD_PATH = 'credentials.to' as Path<DataDestinationFormData>;
const EMAIL_SEPARATOR_REGEX = /[,;\n]/; // comma, semicolon, or newline
const EMAILS_JOIN_SEPARATOR = ', ';
const EMAILS_PLACEHOLDER_FALLBACK = 'Enter emails separated by comma, semicolon or newline';

function parseEmails(raw: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of raw.split(EMAIL_SEPARATOR_REGEX)) {
    const email = part.trim();
    if (!email) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(email);
  }
  return result;
}

function formatEmails(emails: string[]): string {
  return emails.join(EMAILS_JOIN_SEPARATOR);
}

function updateEmailsValue(form: UseFormReturn<DataDestinationFormData>, emails: string[]) {
  form.setValue(
    EMAILS_FIELD_PATH,
    emails as unknown as FieldPathValue<DataDestinationFormData, typeof EMAILS_FIELD_PATH>,
    { shouldDirty: true, shouldTouch: true }
  );
}

function EmailTextarea({
  field,
  form,
  placeholder,
}: {
  field: {
    name: string;
    ref: (instance: HTMLTextAreaElement | null) => void;
    value: unknown;
    onChange: (value: unknown) => void;
    onBlur: () => void;
  };
  form: UseFormReturn<DataDestinationFormData>;
  placeholder: string;
}) {
  // Initialize local value from form value
  const initialString = Array.isArray(field.value) ? formatEmails(field.value as string[]) : '';
  const [rawValue, setRawValue] = useState<string>(initialString);
  const [isFocused, setIsFocused] = useState(false);

  // Keep local state in sync with form value when not focused
  const externalValueString = Array.isArray(field.value)
    ? formatEmails(field.value as string[])
    : '';

  useEffect(() => {
    if (!isFocused) setRawValue(externalValueString);
  }, [externalValueString, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextRaw = e.target.value;
    setRawValue(nextRaw);
    updateEmailsValue(form, parseEmails(nextRaw));
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    setIsFocused(false);
    field.onBlur();
    const emails = parseEmails(e.target.value);
    updateEmailsValue(form, emails);
    setRawValue(formatEmails(emails)); // normalize display value on blur
  };

  return (
    <Textarea
      name={field.name}
      ref={field.ref}
      onFocus={handleFocus}
      onBlur={handleBlur}
      value={rawValue}
      onChange={handleChange}
      className='min-h-[150px] font-mono'
      rows={8}
      placeholder={placeholder}
    />
  );
}

export function EmailFields({
  form,
  emailsFieldTitle,
  description,
}: {
  form: UseFormReturn<DataDestinationFormData>;
  emailsFieldTitle?: string;
  description?: ReactNode;
}) {
  const { t } = useTranslation();
  const placeholder = t('destinationForm.emailPlaceholder', EMAILS_PLACEHOLDER_FALLBACK);

  return (
    <FormField
      control={form.control}
      name={EMAILS_FIELD_PATH}
      render={({ field }) => (
        <FormItem>
          <div className='flex items-center justify-between'>
            <FormLabel tooltip={placeholder}>
              {emailsFieldTitle ?? t('destinationForm.emailList', 'Emails list')}
            </FormLabel>
          </div>
          <FormControl>
            <EmailTextarea field={field} form={form} placeholder={placeholder} />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
