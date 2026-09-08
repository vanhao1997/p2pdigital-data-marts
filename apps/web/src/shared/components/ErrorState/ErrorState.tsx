import { useTranslation } from 'react-i18next';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@owox/ui/components/button';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  const { t } = useTranslation();

  return (
    <div className='flex flex-col items-center justify-center gap-4 p-12 text-center'>
      <AlertCircle className='text-destructive h-12 w-12' />
      <div className='space-y-2'>
        <h3 className='text-lg font-semibold'>{t('errors.somethingWentWrong')}</h3>
        {message && <p className='text-muted-foreground text-sm'>{message}</p>}
      </div>
      {onRetry && (
        <Button variant='outline' onClick={onRetry}>
          <RefreshCw className='mr-2 h-4 w-4' />
          {t('errors.retry')}
        </Button>
      )}
    </div>
  );
}
