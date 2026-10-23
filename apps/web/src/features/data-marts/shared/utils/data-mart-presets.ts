import { DataMartDefinitionType } from '../../shared';
import type { AppIcon } from '../../../../shared/icons';
import {
  FacebookAdsIcon,
  LinkedInAdsIcon,
  TikTokAdsIcon,
  MicrosoftAdsIcon,
} from '../../../../shared';
import { Code, Plug, Box, Table } from 'lucide-react';

// Keys list and type
export const DATA_MART_PRESETS = [
  'facebook',
  'facebook-pages',
  'linkedin',
  'tiktok',
  'tiktok-gmv-max',
  'microsoft',
  'connector',
  'sql',
  'table',
  'blank',
] as const;

export type DataMartPresetKey = (typeof DATA_MART_PRESETS)[number];

// Interface for a preset config
export interface DataMartPreset {
  title: string;
  titleKey: string;
  datamartTitle?: string;
  datamartTitleKey?: string;
  connectorSourceTitle?: string;
  definitionType?: DataMartDefinitionType;
  icon?: AppIcon;
}

// Record map
export const dataMartPresetsMap: Record<DataMartPresetKey, DataMartPreset> = {
  facebook: {
    title: 'Facebook Ads',
    titleKey: 'dataMartPresets.facebook.title',
    datamartTitle: 'Facebook Ads Data Mart',
    datamartTitleKey: 'dataMartPresets.facebook.datamartTitle',
    connectorSourceTitle: 'FacebookMarketing',
    definitionType: DataMartDefinitionType.CONNECTOR,
    icon: FacebookAdsIcon,
  },
  'facebook-pages': {
    title: 'Facebook Fanpage',
    titleKey: 'dataMartPresets.facebookPages.title',
    datamartTitle: 'Facebook Fanpage Data Mart',
    datamartTitleKey: 'dataMartPresets.facebookPages.datamartTitle',
    connectorSourceTitle: 'FacebookPages',
    definitionType: DataMartDefinitionType.CONNECTOR,
    icon: FacebookAdsIcon,
  },
  linkedin: {
    title: 'LinkedIn Ads',
    titleKey: 'dataMartPresets.linkedin.title',
    datamartTitle: 'LinkedIn Ads Data Mart',
    datamartTitleKey: 'dataMartPresets.linkedin.datamartTitle',
    connectorSourceTitle: 'LinkedInAds',
    definitionType: DataMartDefinitionType.CONNECTOR,
    icon: LinkedInAdsIcon,
  },
  tiktok: {
    title: 'TikTok Ads',
    titleKey: 'dataMartPresets.tiktok.title',
    datamartTitle: 'TikTok Ads Data Mart',
    datamartTitleKey: 'dataMartPresets.tiktok.datamartTitle',
    connectorSourceTitle: 'TikTokAds',
    definitionType: DataMartDefinitionType.CONNECTOR,
    icon: TikTokAdsIcon,
  },
  'tiktok-gmv-max': {
    title: 'TikTok GMV Max',
    titleKey: 'dataMartPresets.tiktokGmvMax.title',
    datamartTitle: 'TikTok GMV Max Data Mart',
    datamartTitleKey: 'dataMartPresets.tiktokGmvMax.datamartTitle',
    connectorSourceTitle: 'TikTokGmvMax',
    definitionType: DataMartDefinitionType.CONNECTOR,
    icon: TikTokAdsIcon,
  },
  microsoft: {
    title: 'Microsoft Ads',
    titleKey: 'dataMartPresets.microsoft.title',
    datamartTitle: 'Microsoft Ads Data Mart',
    datamartTitleKey: 'dataMartPresets.microsoft.datamartTitle',
    connectorSourceTitle: 'MicrosoftAds',
    definitionType: DataMartDefinitionType.CONNECTOR,
    icon: MicrosoftAdsIcon,
  },
  connector: {
    title: 'Other connector',
    titleKey: 'dataMartPresets.otherConnector.title',
    datamartTitle: 'Connector-based Data Mart',
    datamartTitleKey: 'dataMartPresets.otherConnector.datamartTitle',
    definitionType: DataMartDefinitionType.CONNECTOR,
    icon: Plug,
  },
  sql: {
    title: 'SQL query',
    titleKey: 'dataMartPresets.sqlQuery.title',
    datamartTitle: 'SQL-based Data Mart',
    datamartTitleKey: 'dataMartPresets.sqlQuery.datamartTitle',
    definitionType: DataMartDefinitionType.SQL,
    icon: Code,
  },
  table: {
    title: 'Existing Table',
    titleKey: 'dataMartPresets.existingTable.title',
    datamartTitle: 'Table-based Data Mart',
    datamartTitleKey: 'dataMartPresets.existingTable.datamartTitle',
    definitionType: DataMartDefinitionType.TABLE,
    icon: Table,
  },
  blank: {
    title: 'Blank Data Mart',
    titleKey: 'dataMartPresets.blankDataMart.title',
    datamartTitle: 'New Data Mart',
    datamartTitleKey: 'dataMartPresets.blankDataMart.datamartTitle',
    icon: Box,
  },
};

// Derived array for UI iteration (buttons, lists)
export const dataMartPresetsList: (DataMartPreset & { key: DataMartPresetKey })[] =
  DATA_MART_PRESETS.map(key => ({
    key,
    ...dataMartPresetsMap[key],
  }));

// Optional helper for safe lookup
export function getDataMartPreset(
  key?: string | null
): (DataMartPreset & { key: DataMartPresetKey }) | undefined {
  if (!key || !DATA_MART_PRESETS.includes(key as DataMartPresetKey)) {
    return undefined;
  }
  const presetKey = key as DataMartPresetKey;
  return { key: presetKey, ...dataMartPresetsMap[presetKey] };
}
