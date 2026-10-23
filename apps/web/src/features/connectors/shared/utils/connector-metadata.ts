import i18n from '../../../../i18n';
import type {
  ConnectorFieldResponseApiDto,
  ConnectorFieldsResponseApiDto,
  ConnectorSpecificationItemResponseApiDto,
  ConnectorSpecificationOneOfResponseApiDto,
  ConnectorSpecificationResponseApiDto,
} from '../api/types/response/connector.response.dto';
import { connectorMetadataVi } from './connector-metadata-vi';
import {
  getConnectorMetadataCatalog,
  registerConnectorMetadataCatalog,
  type ConnectorMetadataTranslationCatalog,
} from './connector-metadata-catalog';
import { humanizeFieldName } from '../../../../shared/utils/field-humanizer';

const BUILT_IN_VI_CATALOG: ConnectorMetadataTranslationCatalog = {
  schemaVersion: 1,
  locale: 'vi',
  sourceVersion: 'connectors-manifest-v1',
  reviewStatus: 'approved',
  entries: connectorMetadataVi,
};

registerConnectorMetadataCatalog(BUILT_IN_VI_CATALOG);

function isVietnamese(): boolean {
  return i18n.resolvedLanguage === 'vi' || i18n.language.startsWith('vi');
}

/** Translate connector-provided labels without changing provider/API identifiers. */
export function translateConnectorMetadata(value?: string): string | undefined {
  if (!value || !isVietnamese()) return value;
  const translations = getConnectorMetadataCatalog('vi')?.entries ?? connectorMetadataVi;
  const directTranslation = translations[value];
  if (directTranslation) return directTranslation;

  // Admicro builds raw-column descriptions from the runtime column ID.
  const rawColumnMatch = /^Admicro source column (\d+)\.$/.exec(value);
  if (rawColumnMatch) {
    return translations['Admicro source column ${id}.'].replace('${id}', rawColumnMatch[1]);
  }

  return value;
}

export { getConnectorMetadataCatalog, registerConnectorMetadataCatalog };

export function localizeConnectorField(
  field: ConnectorFieldResponseApiDto
): ConnectorFieldResponseApiDto {
  const translations = getConnectorMetadataCatalog('vi')?.entries ?? connectorMetadataVi;
  const hasCatalogLabel = Boolean(field.label && translations[field.label]);
  const translatedLabel = translateConnectorMetadata(field.label);
  const label = isVietnamese()
    ? hasCatalogLabel
      ? translatedLabel
      : humanizeFieldName(field.name, { locale: 'vi' })
    : translatedLabel;
  return {
    ...field,
    label,
    description: translateConnectorMetadata(field.description),
  };
}

export function localizeConnectorNode(
  node: ConnectorFieldsResponseApiDto
): ConnectorFieldsResponseApiDto {
  const translations = getConnectorMetadataCatalog('vi')?.entries ?? connectorMetadataVi;
  const hasCatalogOverview = Boolean(node.overview && translations[node.overview]);
  const translatedOverview = translateConnectorMetadata(node.overview);
  return {
    ...node,
    overview: isVietnamese()
      ? hasCatalogOverview
        ? translatedOverview
        : humanizeFieldName(node.name, { locale: 'vi' })
      : translatedOverview,
    description: translateConnectorMetadata(node.description),
    fields: node.fields?.map(localizeConnectorField),
  };
}

function localizeSpecificationItem(
  item: ConnectorSpecificationItemResponseApiDto
): ConnectorSpecificationItemResponseApiDto {
  return {
    ...item,
    title: translateConnectorMetadata(item.title),
    description: translateConnectorMetadata(item.description),
    placeholder: translateConnectorMetadata(item.placeholder),
  };
}

function localizeOneOfOption(
  option: ConnectorSpecificationOneOfResponseApiDto
): ConnectorSpecificationOneOfResponseApiDto {
  return {
    ...option,
    label: translateConnectorMetadata(option.label) ?? option.label,
    items: Object.fromEntries(
      Object.entries(option.items).map(([name, item]) => [name, localizeSpecificationItem(item)])
    ),
  };
}

export function localizeConnectorSpecification(
  specification: ConnectorSpecificationResponseApiDto
): ConnectorSpecificationResponseApiDto {
  return {
    ...localizeSpecificationItem(specification),
    oneOf: specification.oneOf?.map(localizeOneOfOption),
  };
}
