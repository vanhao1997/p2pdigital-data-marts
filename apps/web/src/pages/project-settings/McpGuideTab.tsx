import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { BookOpen, Box, Check, Copy, ExternalLink, ShieldCheck } from 'lucide-react';
import { Button } from '@owox/ui/components/button';
import { useUser } from '../../features/idp/hooks/useAuthState';
import { useClipboard } from '../../hooks/useClipboard';
import { useProjectRoute } from '../../shared/hooks';
import { buildDocsUrl, resolveDocsLocale } from '../../shared/utils/docs-links';

// This published endpoint is not derived from the selected project or the browser origin.
const DIGITALREPORT_MCP_URL = 'https://digitalreport.p2pdigital.io.vn/mcp';
const OPENAI_MCP_GUIDE = 'https://developers.openai.com/api/docs/guides/custom-mcp-server';

export function McpGuideTab() {
  const { t, i18n } = useTranslation();
  const user = useUser();
  const { scope } = useProjectRoute();
  const { copiedSection, copyToClipboard } = useClipboard();
  const [copyError, setCopyError] = useState(false);
  const serverUrl =
    user?.mcpServerUrl && user.mcpServerUrl.length > 0 ? user.mcpServerUrl : DIGITALREPORT_MCP_URL;
  const projectId = user?.projectId ?? '';
  const draftPrompt = t('mcpGuide.draftPrompt', { projectId });
  const validationPrompt = t('mcpGuide.validationPrompt', { projectId });

  async function copy(text: string, section: string) {
    setCopyError(!(await copyToClipboard(text, section)));
  }

  function copyButton(text: string, section: string, label: string) {
    return (
      <Button
        type='button'
        variant='ghost'
        size='icon'
        className='shrink-0'
        aria-label={label}
        title={label}
        onClick={() => void copy(text, section)}
      >
        {copiedSection === section ? <Check className='size-4' /> : <Copy className='size-4' />}
      </Button>
    );
  }

  return (
    <div className='max-w-4xl min-w-0' data-testid='mcpGuide'>
      <header className='space-y-2 pb-6'>
        <h1 className='text-xl font-semibold'>{t('mcpGuide.title')}</h1>
        <p className='text-muted-foreground text-sm'>{t('mcpGuide.intro')}</p>
        <p className='text-sm break-words'>
          <span className='font-medium'>{user?.projectTitle ?? t('mcpGuide.project')}</span>
          {projectId && <code className='text-muted-foreground ml-2 text-xs'>{projectId}</code>}
        </p>
        {user?.projectArchived && (
          <p className='text-destructive text-sm' role='alert'>
            {t('mcpGuide.archived')}
          </p>
        )}
      </header>

      <section className='space-y-3 border-y py-6' aria-labelledby='mcp-connection-title'>
        <h2 id='mcp-connection-title' className='text-base font-semibold'>
          {t('mcpGuide.connectionTitle')}
        </h2>
        <dl className='grid gap-3 text-sm sm:grid-cols-[8rem_minmax(0,1fr)]'>
          <dt className='text-muted-foreground'>{t('mcpGuide.serverName')}</dt>
          <dd>DigitalReport</dd>
          <dt className='text-muted-foreground sm:self-center'>Server URL</dt>
          <dd className='flex min-w-0 items-center gap-2 rounded-md border px-3 py-1'>
            <code className='min-w-0 flex-1 text-xs break-all'>{serverUrl}</code>
            {copyButton(serverUrl, 'mcp-endpoint', t('mcpGuide.copyEndpoint'))}
          </dd>
          <dt className='text-muted-foreground'>Authentication</dt>
          <dd>OAuth / CIMD</dd>
        </dl>
        {!user?.mcpServerUrl && (
          <p className='text-muted-foreground text-xs'>{t('mcpGuide.publishedEndpoint')}</p>
        )}
        <p className='text-muted-foreground text-sm'>{t('mcpGuide.endpointNotice')}</p>
      </section>

      <section className='space-y-4 border-b py-6' aria-labelledby='mcp-steps-title'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <h2 id='mcp-steps-title' className='text-base font-semibold'>
            {t('mcpGuide.stepsTitle')}
          </h2>
          <Button asChild variant='outline' size='sm'>
            <a href='https://chatgpt.com/plugins' target='_blank' rel='noopener noreferrer'>
              <ExternalLink className='size-4' />
              {t('mcpGuide.openChatGpt')}
            </a>
          </Button>
        </div>
        <ol className='list-decimal space-y-3 pl-5 text-sm'>
          {['open', 'server', 'auth', 'consent', 'install', 'chat'].map(step => (
            <li key={step} className='pl-1 leading-6'>
              {t(`mcpGuide.steps.${step}`)}
            </li>
          ))}
        </ol>
      </section>

      <section className='space-y-4 border-b py-6' aria-labelledby='mcp-prompts-title'>
        <h2 id='mcp-prompts-title' className='text-base font-semibold'>
          {t('mcpGuide.promptsTitle')}
        </h2>
        <p className='text-muted-foreground text-sm'>{t('mcpGuide.promptNotice')}</p>
        {[
          {
            section: 'mcp-draft-prompt',
            title: t('mcpGuide.draftTitle'),
            prompt: draftPrompt,
            label: t('mcpGuide.copyDraft'),
          },
          {
            section: 'mcp-validation-prompt',
            title: t('mcpGuide.validationTitle'),
            prompt: validationPrompt,
            label: t('mcpGuide.copyValidation'),
          },
        ].map(({ section, title, prompt, label }) => (
          <div key={section} className='min-w-0'>
            <div className='mb-2 flex items-center justify-between gap-2'>
              <h3 className='text-sm font-medium'>{title}</h3>
              {projectId && copyButton(prompt, section, label)}
            </div>
            <pre className='bg-muted/40 rounded-md border p-4 font-mono text-xs leading-6 [overflow-wrap:anywhere] whitespace-pre-wrap'>
              {prompt}
            </pre>
          </div>
        ))}
        <Button asChild variant='outline' size='sm'>
          <Link to={scope('/data-marts')}>
            <Box className='size-4' />
            {t('mcpGuide.openDataMarts')}
          </Link>
        </Button>
        <p className='text-muted-foreground text-sm'>{t('mcpGuide.acceptance')}</p>
      </section>

      <section className='space-y-3 border-b py-6' aria-labelledby='mcp-safety-title'>
        <h2 id='mcp-safety-title' className='flex items-center gap-2 text-base font-semibold'>
          <ShieldCheck className='size-4 shrink-0' />
          {t('mcpGuide.safetyTitle')}
        </h2>
        <ul className='list-disc space-y-3 pl-5 text-sm leading-6'>
          {['credentials', 'permissions', 'privacy', 'sync', 'capabilities'].map(item => (
            <li key={item}>{t(`mcpGuide.safety.${item}`)}</li>
          ))}
        </ul>
      </section>

      <section className='space-y-3 py-6' aria-labelledby='mcp-troubleshooting-title'>
        <h2 id='mcp-troubleshooting-title' className='text-base font-semibold'>
          {t('mcpGuide.troubleshootingTitle')}
        </h2>
        {['missing', 'redirect', 'unauthorized', 'forbidden', 'tools'].map(item => (
          <details key={item} className='border-b pb-3 text-sm'>
            <summary className='cursor-pointer font-medium'>
              {t(`mcpGuide.troubleshooting.${item}.title`)}
            </summary>
            <p className='text-muted-foreground mt-2 leading-6 [overflow-wrap:anywhere]'>
              {t(`mcpGuide.troubleshooting.${item}.body`)}
            </p>
          </details>
        ))}
        <div className='flex flex-wrap gap-4 pt-2 text-sm'>
          <a
            href={OPENAI_MCP_GUIDE}
            target='_blank'
            rel='noopener noreferrer'
            className='text-primary inline-flex items-center gap-2 hover:underline'
          >
            <BookOpen className='size-4 shrink-0' />
            {t('mcpGuide.openaiDocs')}
          </a>
          <a
            href={buildDocsUrl(
              'getting-started/setup-guide/mcp',
              resolveDocsLocale(i18n.language),
              'mcp_guide'
            )}
            target='_blank'
            rel='noopener noreferrer'
            className='text-primary inline-flex items-center gap-2 hover:underline'
          >
            <BookOpen className='size-4 shrink-0' />
            {t('mcpGuide.productDocs')}
          </a>
        </div>
      </section>
      <p role='status' className='text-muted-foreground text-sm'>
        {copiedSection ? t('mcpGuide.copied') : ''}
      </p>
      {copyError && (
        <p role='alert' className='text-destructive text-sm'>
          {t('mcpGuide.copyFailed')}
        </p>
      )}
    </div>
  );
}
