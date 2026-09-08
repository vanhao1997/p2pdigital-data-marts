import { Button } from '@owox/ui/components/button';
import { Plus } from 'lucide-react';
import { DataMartConnectorView } from '../../DataMartConnectorView';
import { DataStorageType } from '../../../../data-storage';
import type { ConnectorConfig } from '../../../../data-marts/edit';
import { useTranslation } from 'react-i18next';

interface AddConfigurationButtonProps {
  storageType: DataStorageType;
  onAddConfiguration: (connector: ConnectorConfig) => void;
  existingConnector?: ConnectorConfig;
}

export function AddConfigurationButton({
  storageType,
  onAddConfiguration,
  existingConnector,
}: AddConfigurationButtonProps) {
  const { t } = useTranslation();
  return (
    <div>
      <DataMartConnectorView
        dataStorageType={storageType}
        onSubmit={(connector: ConnectorConfig) => {
          // Pass the whole connector (not just configuration[0]) so the Data Level-derived
          // fields computed in ConnectorEditForm reach addConfiguration and get merged in.
          onAddConfiguration(connector);
        }}
        configurationOnly={true}
        existingConnector={
          existingConnector
            ? {
                source: {
                  ...existingConnector.source,
                  configuration: [],
                },
                storage: existingConnector.storage,
              }
            : undefined
        }
      >
        <Button type='button' variant='outline'>
          <Plus className='h-4 w-4' />
          <span>{t('common.configuration')}</span>
        </Button>
      </DataMartConnectorView>
    </div>
  );
}
