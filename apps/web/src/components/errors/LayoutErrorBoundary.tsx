import { useEffect } from 'react';
import { useRouteError, isRouteErrorResponse, Link } from 'react-router';
import { Button } from '@owox/ui/components/button';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { logRouteError } from './logRouteError';
import i18n from '../../i18n';

export function LayoutErrorBoundary() {
  const error = useRouteError();

  useEffect(() => {
    logRouteError(error);
  }, [error]);

  if (isRouteErrorResponse(error) && error.status === 404) {
    return null;
  }

  return (
    <div className='dm-empty-state-404page'>
      <div className='dm-empty-state-404page-foreground'>
        <AlertTriangle className='dm-empty-state-ico' strokeWidth={1} />

        <h1 className='dm-empty-state-title'>
          {i18n.t('errorBoundary.title', 'Something went wrong')}
        </h1>

        <p className='dm-empty-state-subtitle'>
          {i18n.t(
            'errorBoundary.subtitleLayout',
            'The app hit an unexpected glitch. Don’t worry — your data is safe. Try navigating to another section or heading home.'
          )}
        </p>

        <div className='flex items-center gap-3'>
          <Button variant='default' asChild>
            <Link
              to={'/'}
              className='flex items-center gap-1'
              aria-label={i18n.t('errorBoundary.home', 'Guide Me Home')}
            >
              {i18n.t('errorBoundary.home', 'Guide Me Home')}
              <ChevronRight className='h-4 w-4' />
            </Link>
          </Button>
          <Button
            variant='outline'
            onClick={() => {
              window.location.reload();
            }}
          >
            {i18n.t('errorBoundary.reload', 'Reload Page')}
          </Button>
        </div>

        {import.meta.env.DEV && error instanceof Error && (
          <details className='mt-8 w-full max-w-2xl'>
            <summary className='text-muted-foreground cursor-pointer text-sm'>
              {i18n.t('errorBoundary.details', 'Error details')}
            </summary>
            <pre className='text-muted-foreground mt-2 overflow-auto rounded border p-4 text-xs'>
              {error.message}
              {'\n\n'}
              {error.stack}
            </pre>
          </details>
        )}
      </div>

      <div className='dm-empty-state-404page-background' />
    </div>
  );
}
