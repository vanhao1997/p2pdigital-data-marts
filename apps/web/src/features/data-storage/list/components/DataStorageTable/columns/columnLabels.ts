import { DataStorageColumnKey } from './columnKeys';
import type { TFunction } from 'i18next';

export const dataStorageColumnLabels: Record<DataStorageColumnKey, string> = {
  [DataStorageColumnKey.HEALTH]: 'Health status',
  [DataStorageColumnKey.TITLE]: 'Title',
  [DataStorageColumnKey.TYPE]: 'Type',
  [DataStorageColumnKey.CREATED_AT]: 'Created At',
  [DataStorageColumnKey.CREATED_BY]: 'Created By',
  [DataStorageColumnKey.OWNERS]: 'Owners',
  [DataStorageColumnKey.DATA_MARTS_COUNT]: 'Published Data Marts',
  [DataStorageColumnKey.DRAFTS_COUNT]: 'Draft Data Marts',
  [DataStorageColumnKey.CONTEXTS]: 'Contexts',
};

export function getDataStorageColumnLabels(t: TFunction): Record<DataStorageColumnKey, string> {
  return {
    [DataStorageColumnKey.HEALTH]: t('storageTableColumns.health', 'Health status'),
    [DataStorageColumnKey.TITLE]: t('common.title'),
    [DataStorageColumnKey.TYPE]: t('common.type'),
    [DataStorageColumnKey.CREATED_AT]: t('common.createdAt'),
    [DataStorageColumnKey.CREATED_BY]: t('common.createdBy'),
    [DataStorageColumnKey.OWNERS]: t('storageTableColumns.owners', 'Owners'),
    [DataStorageColumnKey.DATA_MARTS_COUNT]: t(
      'storageTableColumns.publishedDataMarts',
      'Published Data Marts'
    ),
    [DataStorageColumnKey.DRAFTS_COUNT]: t(
      'storageTableColumns.draftDataMarts',
      'Draft Data Marts'
    ),
    [DataStorageColumnKey.CONTEXTS]: t('dataMartTableColumns.contexts', 'Contexts'),
  };
}
