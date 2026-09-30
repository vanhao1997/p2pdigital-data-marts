import { AlertCircle, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@owox/ui/components/button';

interface VideoFrameProps {
  src: string;
  aspectRatio: string;
  titleKey: string;
}

export function VideoFrame({ src, aspectRatio, titleKey }: VideoFrameProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);

  return (
    <div className='bg-muted relative overflow-hidden rounded-md' style={{ aspectRatio }}>
      {status === 'loading' && (
        <div className='text-muted-foreground absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/5 text-sm dark:bg-white/5'>
          <Loader2 className='h-5 w-5 animate-spin' aria-hidden='true' />
          <span>{t('contentPopovers.videoLoading')}</span>
        </div>
      )}
      {status === 'error' && (
        <div className='text-muted-foreground absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/5 p-4 text-center text-sm dark:bg-white/5'>
          <AlertCircle className='text-destructive h-5 w-5' aria-hidden='true' />
          <span>{t('contentPopovers.videoError')}</span>
          <Button
            size='sm'
            variant='outline'
            onClick={() => {
              setStatus('loading');
              setAttempt(value => value + 1);
            }}
          >
            {t('contentPopovers.videoRetry')}
          </Button>
        </div>
      )}
      <iframe
        key={attempt}
        src={src}
        title={t(titleKey)}
        loading='lazy'
        onLoad={() => {
          setStatus('ready');
        }}
        onError={() => {
          setStatus('error');
        }}
        className='absolute inset-0 h-full w-full rounded-md border-none'
        allow='accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;'
        allowFullScreen
      />
    </div>
  );
}
