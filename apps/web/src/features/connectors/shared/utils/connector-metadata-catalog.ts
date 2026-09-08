export const CONNECTOR_METADATA_CATALOG_VERSION = 1 as const;

export type ConnectorMetadataReviewStatus = 'approved';

export interface ConnectorMetadataTranslationCatalog {
  schemaVersion: typeof CONNECTOR_METADATA_CATALOG_VERSION;
  locale: string;
  sourceVersion: string;
  reviewStatus: ConnectorMetadataReviewStatus;
  entries: Record<string, string>;
}

const catalogs = new Map<string, ConnectorMetadataTranslationCatalog>();

export function registerConnectorMetadataCatalog(
  catalog: unknown
): catalog is ConnectorMetadataTranslationCatalog {
  if (!isCatalog(catalog)) return false;
  catalogs.set(catalog.locale, {
    ...catalog,
    entries: { ...catalog.entries },
  });
  return true;
}

export function getConnectorMetadataCatalog(
  locale: string
): ConnectorMetadataTranslationCatalog | undefined {
  return catalogs.get(locale);
}

function isCatalog(value: unknown): value is ConnectorMetadataTranslationCatalog {
  if (!isRecord(value)) return false;
  if (value.schemaVersion !== CONNECTOR_METADATA_CATALOG_VERSION) return false;
  if (typeof value.locale !== 'string' || !/^[a-z]{2}(?:-[A-Z]{2})?$/.test(value.locale))
    return false;
  if (typeof value.sourceVersion !== 'string' || value.sourceVersion.length > 120) return false;
  if (value.reviewStatus !== 'approved' || !isRecord(value.entries)) return false;

  const entries = Object.entries(value.entries);
  if (entries.length > 10000) return false;
  return entries.every(
    ([key, translation]) =>
      key.length > 0 &&
      key.length <= 500 &&
      typeof translation === 'string' &&
      translation.length <= 2000
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
