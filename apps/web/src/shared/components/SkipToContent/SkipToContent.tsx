import { useTranslation } from 'react-i18next';

export function SkipToContent() {
  const { t } = useTranslation();

  return (
    <a
      href='#main-content'
      className='focus:bg-background focus:ring-ring sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-md focus:ring-2'
    >
      {t('accessibility.skipToContent')}
    </a>
  );
}
