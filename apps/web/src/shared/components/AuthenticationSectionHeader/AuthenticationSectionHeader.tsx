import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { Tooltip, TooltipContent, TooltipTrigger } from '@owox/ui/components/tooltip';
import { Copy, Info, X } from 'lucide-react';
import type { ReactNode } from 'react';
import type { CredentialIdentity } from '../../types/credential-identity';
import { getAuthTypeLabel, getIdentityDisplayString } from '../../utils/credential-identity-utils';
import { useTranslation } from 'react-i18next';

interface AuthenticationSectionHeaderProps {
  copyButton?: ReactNode;
  itemType: 'storage' | 'destination';
  selectedSource?: {
    id: string;
    title: string;
    identity: CredentialIdentity | null;
  } | null;
  onSourceClear?: () => void;
}

export function AuthenticationSectionHeader({
  copyButton,
  itemType,
  selectedSource,
  onSourceClear,
}: AuthenticationSectionHeaderProps) {
  const { t } = useTranslation();
  const authTypeLabel = selectedSource ? getAuthTypeLabel(selectedSource.identity) : '';
  const identityDisplay = selectedSource ? getIdentityDisplayString(selectedSource.identity) : '';

  return (
    <>
      <div className='flex items-center justify-between'>
        <h3 className='text-muted-foreground/75 text-xs font-semibold tracking-wide uppercase'>
          {t('authentication.authentication', 'Authentication')}
        </h3>
        {copyButton}
      </div>
      {selectedSource && onSourceClear && (
        <div className='group border-border flex flex-col gap-2 rounded-md border-b bg-white px-4 py-3 transition-shadow duration-200 hover:shadow-sm dark:border-white/4 dark:bg-white/4'>
          <span className='text-foreground flex items-center justify-between gap-2 text-sm font-medium'>
            <span>{t('authentication.copiedFrom', 'Credentials will be copied from')}</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type='button'
                  tabIndex={-1}
                  className='pointer-events-none opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100'
                  aria-label={t('common.helpInformation', 'Help information')}
                >
                  <Info
                    className='text-muted-foreground/50 hover:text-muted-foreground size-4 shrink-0 transition-colors'
                    aria-hidden='true'
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent side='top' align='center' role='tooltip'>
                {t('authentication.copiedFromAnother', 'Credentials are copied from another item')}
              </TooltipContent>
            </Tooltip>
          </span>
          <div className='border-input flex w-full items-center justify-between rounded-md border bg-transparent px-3 py-2'>
            <div className='flex items-center gap-2'>
              <Copy className='text-muted-foreground h-4 w-4 shrink-0' />
              <div className='flex flex-col'>
                <div className='flex items-center gap-2'>
                  <span className='text-sm'>{selectedSource.title}</span>
                  {authTypeLabel && (
                    <span className='text-muted-foreground text-xs'>({authTypeLabel})</span>
                  )}
                </div>
                {identityDisplay && (
                  <span className='text-muted-foreground text-xs'>{identityDisplay}</span>
                )}
              </div>
            </div>
            <button
              type='button'
              onClick={onSourceClear}
              className='text-muted-foreground hover:text-foreground -mr-1 cursor-pointer rounded-sm p-0.5 transition-colors'
              aria-label={t('authentication.clearSource', 'Clear source selection')}
            >
              <X className='h-4 w-4' />
            </button>
          </div>
          <div className='text-muted-foreground text-sm'>
            <Accordion variant='common' type='single' collapsible>
              <AccordionItem value='copied-credentials-details'>
                <AccordionTrigger>
                  {t('authentication.whatAreCopied', 'What are copied credentials?')}
                </AccordionTrigger>
                <AccordionContent>
                  <p>
                    {t(
                      'authentication.copiedDescription',
                      'When you copy credentials, the authentication details (such as API keys, service accounts, or access tokens) from an existing {{itemType}} are reused for this one. This means you do not need to enter them again manually. The credentials are copied at save time — future changes to the original {{itemType}} do not affect this copy.',
                      { itemType }
                    )}
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      )}
    </>
  );
}
