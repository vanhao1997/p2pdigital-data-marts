import { DataMartColumnKey } from './columnKeys';
import type { TFunction } from 'i18next';

export const dataMartColumnLabels: Record<DataMartColumnKey, string> = {
  [DataMartColumnKey.TITLE]: 'Title',
  [DataMartColumnKey.DEFINITION_TYPE]: 'Input Source',
  [DataMartColumnKey.STORAGE_TYPE]: 'Storage',
  [DataMartColumnKey.STATUS]: 'Status',
  [DataMartColumnKey.TRIGGERS_COUNT]: 'Triggers',
  [DataMartColumnKey.REPORTS_COUNT]: 'Reports',
  [DataMartColumnKey.CREATED_AT]: 'Created At',
  [DataMartColumnKey.CREATED_BY_USER]: 'Created By',
  [DataMartColumnKey.HEALTH_STATUS]: 'Health Status',
  [DataMartColumnKey.BUSINESS_OWNERS]: 'Business Owner',
  [DataMartColumnKey.TECHNICAL_OWNERS]: 'Technical Owner',
  [DataMartColumnKey.CONTEXTS]: 'Contexts',
  [DataMartColumnKey.AVAILABLE_FOR_REPORTING]: 'Shared for reporting',
  [DataMartColumnKey.AVAILABLE_FOR_MAINTENANCE]: 'Shared for maintenance',
  [DataMartColumnKey.DATA_LAST_UPDATED]: 'Data Last Updated',
};

export function getDataMartColumnLabels(t: TFunction): Record<DataMartColumnKey, string> {
  return {
    [DataMartColumnKey.TITLE]: t('common.title'),
    [DataMartColumnKey.DEFINITION_TYPE]: t('dataMartTableColumns.inputSource', 'Input source'),
    [DataMartColumnKey.STORAGE_TYPE]: t('dataMartTableColumns.storage', 'Storage'),
    [DataMartColumnKey.STATUS]: t('common.status'),
    [DataMartColumnKey.TRIGGERS_COUNT]: t('dataMartTableColumns.triggers', 'Triggers'),
    [DataMartColumnKey.REPORTS_COUNT]: t('dataMartTableColumns.reports', 'Reports'),
    [DataMartColumnKey.CREATED_AT]: t('common.createdAt'),
    [DataMartColumnKey.CREATED_BY_USER]: t('common.createdBy'),
    [DataMartColumnKey.HEALTH_STATUS]: t('dataMartTableColumns.healthStatus', 'Health status'),
    [DataMartColumnKey.BUSINESS_OWNERS]: t('dataMartTableColumns.businessOwner', 'Business owner'),
    [DataMartColumnKey.TECHNICAL_OWNERS]: t(
      'dataMartTableColumns.technicalOwner',
      'Technical owner'
    ),
    [DataMartColumnKey.CONTEXTS]: t('dataMartTableColumns.contexts', 'Contexts'),
    [DataMartColumnKey.AVAILABLE_FOR_REPORTING]: t(
      'dataMartTableColumns.sharedForReporting',
      'Shared for reporting'
    ),
    [DataMartColumnKey.AVAILABLE_FOR_MAINTENANCE]: t(
      'dataMartTableColumns.sharedForMaintenance',
      'Shared for maintenance'
    ),
    [DataMartColumnKey.DATA_LAST_UPDATED]: t(
      'dataMartTableColumns.dataLastUpdated',
      'Data last updated'
    ),
  };
}
