import { useParams } from 'react-router';
import { DataMartProvider, DataMartDetails } from '../../../features/data-marts/edit';
import { useTranslation } from 'react-i18next';

/**
 * Route parameters for DataMartDetailsPage
 */
interface DataMartDetailsParams extends Record<string, string | undefined> {
  id: string;
  projectId: string;
}

export function DataMartDetailsPage() {
  const { t } = useTranslation();
  const params = useParams<DataMartDetailsParams>();
  const { id, projectId } = params;

  if (!id) {
    return (
      <div className='dm-page-header'>
        {t('dataMartDetailsPage.dataMartIdRequired', 'Data Mart ID is required')}
      </div>
    );
  }

  if (!projectId) {
    return (
      <div className='dm-page-header'>
        {t('dataMartDetailsPage.projectIdRequired', 'Project ID is required')}
      </div>
    );
  }

  return (
    <div className='dm-page'>
      <DataMartProvider>
        <DataMartDetails id={id} />
      </DataMartProvider>
    </div>
  );
}
