import { DataMartSchemaFieldStatus, type DataMartSchema } from '../types/data-mart-schema.types';
import i18n from '../../../../i18n';

export interface SchemaFieldSummary {
  connected: number;
  disconnected: number;
  mismatched: number;
  total: number;
}

interface CountableField {
  status?: DataMartSchemaFieldStatus;
  fields?: CountableField[];
}

function countField(field: CountableField, summary: SchemaFieldSummary): void {
  summary.total += 1;

  switch (field.status) {
    case DataMartSchemaFieldStatus.DISCONNECTED:
      summary.disconnected += 1;
      break;
    case DataMartSchemaFieldStatus.CONNECTED_WITH_DEFINITION_MISMATCH:
      summary.mismatched += 1;
      break;
    default:
      // A field with no status has never been through a merge, which only happens on a schema
      // that was just read for the first time. Those fields are connected by construction.
      summary.connected += 1;
  }

  // Only BigQuery has nested fields today; the recursion is a no-op elsewhere.
  for (const nested of field.fields ?? []) {
    countField(nested, summary);
  }
}

/**
 * Counts fields by connection status across the whole schema, nested fields included.
 * Used to tell the user what a refreshed schema actually looks like — most importantly, how many
 * fields the new source no longer provides.
 */
export function summarizeSchemaFields(
  schema: DataMartSchema | null | undefined
): SchemaFieldSummary {
  const summary: SchemaFieldSummary = {
    connected: 0,
    disconnected: 0,
    mismatched: 0,
    total: 0,
  };

  for (const field of (schema?.fields ?? []) as CountableField[]) {
    countField(field, summary);
  }

  return summary;
}

/**
 * Human-readable one-liner for a schema refresh. Stays short when everything is fine and only
 * spells out the problems when there are any.
 */
export function describeSchemaFieldSummary(summary: SchemaFieldSummary): string {
  if (summary.total === 0) {
    return i18n.t('schemaFieldSummary.actualized');
  }

  const problems: string[] = [];
  if (summary.disconnected > 0) {
    problems.push(i18n.t('schemaFieldSummary.disconnected', { count: summary.disconnected }));
  }
  if (summary.mismatched > 0) {
    problems.push(i18n.t('schemaFieldSummary.typeMismatch', { count: summary.mismatched }));
  }

  if (problems.length === 0) {
    return i18n.t('schemaFieldSummary.actualizedConnected', {
      count: summary.total,
      fieldWord: i18n.t(
        summary.total === 1 ? 'schemaFieldSummary.field' : 'schemaFieldSummary.fields'
      ),
    });
  }

  return i18n.t('schemaFieldSummary.actualizedWithProblems', {
    count: summary.total,
    fieldWord: i18n.t(
      summary.total === 1 ? 'schemaFieldSummary.field' : 'schemaFieldSummary.fields'
    ),
    problems: problems.join(', '),
  });
}
