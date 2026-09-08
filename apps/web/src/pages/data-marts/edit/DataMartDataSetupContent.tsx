import { useState } from 'react';
import { useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  DataMartDataStorageView,
  DataMartDefinitionSettings,
  DataMartSchemaSettings,
} from '../../../features/data-marts/edit';
import { useDataMartContext } from '../../../features/data-marts/edit/model';
import {
  CollapsibleCard,
  CollapsibleCardHeader,
  CollapsibleCardHeaderTitle,
  CollapsibleCardContent,
  CollapsibleCardFooter,
} from '../../../shared/components/CollapsibleCard';
import { DatabaseIcon, CodeIcon, Columns3 } from 'lucide-react';
import { DataMartRelationshipsContent } from '../../../features/data-marts/edit/components/DataMartRelationships/DataMartRelationshipsContent';
import type { DataMartDefinitionType } from '../../../features/data-marts/shared';
import { DataQualityCompactStatusLink } from '../../../features/data-marts/data-quality';

export default function DataMartDataSetupContent() {
  const { t } = useTranslation();
  const { dataMart, updateDataMartStorage } = useDataMartContext();
  const { projectId = '' } = useParams<{ projectId: string }>();
  const initialDefinitionType = dataMart?.definitionType ?? null;
  const [definitionType, setDefinitionType] = useState<DataMartDefinitionType | null>(
    initialDefinitionType
  );
  const [sqlRevalidateVersion, setSqlRevalidateVersion] = useState(0);

  return (
    <div className={'flex flex-col gap-4'} data-testid='datamartTabDataSetup'>
      <CollapsibleCard collapsible name={'data-storage'}>
        <CollapsibleCardHeader>
          <CollapsibleCardHeaderTitle
            icon={DatabaseIcon}
            tooltip={t(
              'dataMartDataSetup.storageTooltip',
              'Configure where your data will be stored'
            )}
          >
            {t('dataMartDataSetup.storage', 'Storage')}
          </CollapsibleCardHeaderTitle>
        </CollapsibleCardHeader>
        <CollapsibleCardContent>
          {dataMart?.storage && (
            <DataMartDataStorageView
              dataStorage={dataMart.storage}
              onDataStorageChange={updateDataMartStorage}
              onEditSheetClose={({ hasChanges }) => {
                // We use an incrementing token instead of a boolean flag because
                // repeated close events must trigger repeated SQL validator re-runs.
                if (hasChanges) {
                  setSqlRevalidateVersion(version => version + 1);
                }
              }}
            ></DataMartDataStorageView>
          )}
        </CollapsibleCardContent>
        <CollapsibleCardFooter></CollapsibleCardFooter>
      </CollapsibleCard>

      <CollapsibleCard collapsible name={'input-source'}>
        <CollapsibleCardHeader>
          <CollapsibleCardHeaderTitle
            icon={CodeIcon}
            tooltip={t(
              'dataMartDataSetup.inputSourceTooltip',
              'Configure how to extract data from your data warehouse'
            )}
          >
            {t('dataMartDataSetup.inputSource', 'Input source')}
          </CollapsibleCardHeaderTitle>
        </CollapsibleCardHeader>
        <CollapsibleCardContent>
          {dataMart && (
            <DataMartDefinitionSettings
              definitionType={definitionType}
              initialDefinitionType={initialDefinitionType}
              setDefinitionType={setDefinitionType}
              sqlRevalidateVersion={sqlRevalidateVersion}
            />
          )}
        </CollapsibleCardContent>
        <CollapsibleCardFooter></CollapsibleCardFooter>
      </CollapsibleCard>

      <CollapsibleCard collapsible name={'output-schema'}>
        <CollapsibleCardHeader>
          <CollapsibleCardHeaderTitle
            icon={Columns3}
            tooltip={t(
              'dataMartDataSetup.outputSchemaTooltip',
              'Configure your data mart output schema'
            )}
          >
            {t('dataMartDataSetup.outputSchema', 'Output schema')}
          </CollapsibleCardHeaderTitle>
        </CollapsibleCardHeader>
        <CollapsibleCardContent>
          {dataMart && projectId && (
            <DataQualityCompactStatusLink projectId={projectId} dataMartId={dataMart.id} />
          )}
          {dataMart && <DataMartSchemaSettings definitionType={definitionType} />}
        </CollapsibleCardContent>
        <CollapsibleCardFooter></CollapsibleCardFooter>
      </CollapsibleCard>

      <DataMartRelationshipsContent />
    </div>
  );
}
