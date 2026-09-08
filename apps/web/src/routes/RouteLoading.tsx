import { useTranslation } from 'react-i18next';

export function RouteLoading() {
  const { t } = useTranslation();

  return (
    <div className='text-muted-foreground flex min-h-32 items-center justify-center text-sm'>
      {t('common.loading', 'Loading...')}
    </div>
  );
}
