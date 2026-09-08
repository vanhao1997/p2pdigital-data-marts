import { useEffect } from 'react';
import { useDataMartList } from '../../model/hooks';
import { DataMartListItemComponent } from './DataMartListItem.tsx';
import { useTranslation } from 'react-i18next';

export function DataMartList() {
  const { t } = useTranslation();
  const { items, loading, error, loadDataMarts } = useDataMartList();

  useEffect(() => {
    void (async () => {
      await loadDataMarts();
    })();
  }, [loadDataMarts]);

  if (loading) return <div>{t('common.loading', 'Loading...')}</div>;
  if (error)
    return (
      <div>
        {t('common.error', 'Error')}: {error}
      </div>
    );

  return (
    <div data-testid='datamartList'>
      {items.map(item => (
        <DataMartListItemComponent key={item.id} item={item} />
      ))}
    </div>
  );
}
