import { describe, expect, it } from 'vitest';
import {
  CONNECTOR_METADATA_CATALOG_VERSION,
  getConnectorMetadataCatalog,
  registerConnectorMetadataCatalog,
} from './connector-metadata-catalog';

describe('connector metadata translation catalog', () => {
  it('accepts only approved, versioned catalogs', () => {
    expect(
      registerConnectorMetadataCatalog({
        schemaVersion: CONNECTOR_METADATA_CATALOG_VERSION,
        locale: 'en',
        sourceVersion: 'test-v2',
        reviewStatus: 'approved',
        entries: { 'Test label': 'Nhãn kiểm thử' },
      })
    ).toBe(true);

    expect(getConnectorMetadataCatalog('en')).toMatchObject({
      schemaVersion: 1,
      sourceVersion: 'test-v2',
      entries: { 'Test label': 'Nhãn kiểm thử' },
    });
  });

  it('rejects unreviewed or incompatible catalogs', () => {
    expect(
      registerConnectorMetadataCatalog({
        schemaVersion: 2,
        locale: 'en',
        sourceVersion: 'test-v2',
        reviewStatus: 'approved',
        entries: {},
      })
    ).toBe(false);
    expect(
      registerConnectorMetadataCatalog({
        schemaVersion: 1,
        locale: 'en',
        sourceVersion: 'test-v2',
        reviewStatus: 'draft',
        entries: {},
      })
    ).toBe(false);
  });
});
