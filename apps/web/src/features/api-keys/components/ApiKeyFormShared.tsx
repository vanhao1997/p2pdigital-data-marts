import type { ReactNode } from 'react';
import { FormLabel, FormSection } from '@owox/ui/components/form';
import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import i18n from '../../../i18n';
import { buildDocsUrl, resolveDocsLocale } from '../../../shared/utils/docs-links';

interface ApiKeyFormLabelProps {
  description: string;
  children: ReactNode;
}

export function ApiKeyFormLabel({ description, children }: ApiKeyFormLabelProps) {
  return <FormLabel tooltip={description}>{children}</FormLabel>;
}

interface DocumentationLinkProps {
  href: string;
  title: string;
  description?: string;
  code?: boolean;
}

function DocumentationLink({ href, title, description, code = false }: DocumentationLinkProps) {
  const label = description ? `${title} ${description}` : title;

  return (
    <a
      href={href}
      target='_blank'
      rel='noopener noreferrer'
      aria-label={label}
      className='group border-border/70 text-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex min-h-11 w-full items-center justify-between rounded-md border bg-white/60 px-3 py-2 text-sm font-medium no-underline shadow-xs transition-colors hover:bg-white focus-visible:ring-[3px] focus-visible:outline-none dark:border-white/8 dark:bg-white/4 dark:hover:bg-white/8'
    >
      <span className='flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5'>
        {code ? (
          <code className='bg-muted text-foreground rounded px-1.5 py-0.5 font-mono text-xs font-medium'>
            {title}
          </code>
        ) : (
          <span className='truncate'>{title}</span>
        )}
        {description ? <span className='truncate'>{description}</span> : null}
      </span>
      <ExternalLink
        className='text-muted-foreground ml-2 size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100 group-focus-visible:opacity-100'
        aria-hidden='true'
      />
    </a>
  );
}

export function ApiKeyDocumentationSection({ name }: { name: string }) {
  const { t } = useTranslation();
  const locale = resolveDocsLocale(i18n.language);

  return (
    <FormSection title={t('apiKeysPage.documentation.title')} name={name} defaultOpen={false}>
      <DocumentationLink
        href={buildDocsUrl('api/api-keys', locale, 'api_keys_form')}
        title={t('apiKeysPage.documentation.apiKeys')}
      />
      <DocumentationLink
        href={buildDocsUrl('api/owox-ctl', locale, 'api_keys_form')}
        title='owox-ctl'
        description={t('apiKeysPage.documentation.cliTool')}
        code
      />
      <DocumentationLink
        href={buildDocsUrl('api/api-client', locale, 'api_keys_form')}
        title='@owox/api-client'
        description={t('apiKeysPage.documentation.apiClient')}
        code
      />
      <DocumentationLink
        href={buildDocsUrl('api/openapi', locale, 'api_keys_form')}
        title={t('apiKeysPage.documentation.openapi')}
      />
    </FormSection>
  );
}
