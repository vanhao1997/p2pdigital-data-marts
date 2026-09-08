import type {
  DataQualityCategory,
  DataQualityConfig,
  DataQualityCheckResult,
  DataQualityStatusPresentation,
  DataQualitySummaryState,
  EffectiveDataQualityConfig,
  EffectiveDataQualityRuleConfig,
} from './types';
import i18n from '../../../../i18n';

const DATA_QUALITY_CATEGORY_LABEL_KEYS: Record<DataQualityCategory, string> = {
  empty_table: 'dataQualityUi.categoryLabels.emptyTable',
  pk_uniqueness: 'dataQualityUi.categoryLabels.primaryKeyUniqueness',
  duplicate_rows: 'dataQualityUi.categoryLabels.duplicateRows',
  null_rate: 'dataQualityUi.categoryLabels.nullRate',
  column_uniqueness: 'dataQualityUi.categoryLabels.columnUniqueness',
  constant_column: 'dataQualityUi.categoryLabels.constantColumn',
  type_mismatch: 'dataQualityUi.categoryLabels.typeMismatch',
  data_freshness: 'dataQualityUi.categoryLabels.dataFreshness',
  negative_values: 'dataQualityUi.categoryLabels.negativeValues',
  relationship_integrity: 'dataQualityUi.categoryLabels.relationshipIntegrity',
  reverse_relationship: 'dataQualityUi.categoryLabels.reverseRelationship',
};

const DATA_QUALITY_CATEGORY_DESCRIPTION_KEYS: Record<DataQualityCategory, string> = {
  empty_table: 'dataQualityUi.categoryDescriptions.emptyTable',
  pk_uniqueness: 'dataQualityUi.categoryDescriptions.primaryKeyUniqueness',
  duplicate_rows: 'dataQualityUi.categoryDescriptions.duplicateRows',
  null_rate: 'dataQualityUi.categoryDescriptions.nullRate',
  column_uniqueness: 'dataQualityUi.categoryDescriptions.columnUniqueness',
  constant_column: 'dataQualityUi.categoryDescriptions.constantColumn',
  type_mismatch: 'dataQualityUi.categoryDescriptions.typeMismatch',
  data_freshness: 'dataQualityUi.categoryDescriptions.dataFreshness',
  negative_values: 'dataQualityUi.categoryDescriptions.negativeValues',
  relationship_integrity: 'dataQualityUi.categoryDescriptions.relationshipIntegrity',
  reverse_relationship: 'dataQualityUi.categoryDescriptions.reverseRelationship',
};

const STATUS_PRESENTATION_KEYS: Record<
  DataQualitySummaryState,
  { title: string; description?: string }
> = {
  NEVER_RUN: {
    title: 'dataQualityUi.statusPresentations.neverRunTitle',
    description: 'dataQualityUi.statusPresentations.neverRunDescription',
  },
  QUEUED: {
    title: 'dataQualityUi.statusPresentations.queuedTitle',
    description: 'dataQualityUi.statusPresentations.queuedDescription',
  },
  RUNNING: {
    title: 'dataQualityUi.statusPresentations.runningTitle',
  },
  PASSED: {
    title: 'dataQualityUi.statusPresentations.passedTitle',
    description: 'dataQualityUi.statusPresentations.passedDescription',
  },
  ISSUES: {
    title: 'dataQualityUi.statusPresentations.issuesTitle',
    description: 'dataQualityUi.statusPresentations.issuesDescription',
  },
  EXECUTION_FAILED: {
    title: 'dataQualityUi.statusPresentations.executionFailedTitle',
    description: 'dataQualityUi.statusPresentations.executionFailedDescription',
  },
  RESTRICTED: {
    title: 'dataQualityUi.statusPresentations.restrictedTitle',
    description: 'dataQualityUi.statusPresentations.restrictedDescription',
  },
  CANCELLED: {
    title: 'dataQualityUi.statusPresentations.cancelledTitle',
    description: 'dataQualityUi.statusPresentations.cancelledDescription',
  },
  ALL_DISABLED: {
    title: 'dataQualityUi.statusPresentations.allDisabledTitle',
    description: 'dataQualityUi.statusPresentations.allDisabledDescription',
  },
};

export function toStoredDataQualityConfig(config: EffectiveDataQualityConfig): DataQualityConfig {
  return {
    rules: config.rules.map(
      ({
        key,
        category,
        scope,
        severity,
        enabled,
        parameters,
      }): DataQualityConfig['rules'][number] => ({
        key,
        category,
        scope:
          scope.type === 'FIELD'
            ? { type: scope.type, fieldPath: [...scope.fieldPath] }
            : { ...scope },
        severity,
        enabled,
        parameters: { ...parameters },
      })
    ),
  };
}

export function getDataQualityStatusPresentation(summary: {
  state: DataQualitySummaryState;
  totalChecks?: number;
  notApplicableChecks?: number;
}): DataQualityStatusPresentation {
  if ((summary.totalChecks ?? 0) > 0 && summary.notApplicableChecks === summary.totalChecks) {
    return {
      title: i18n.t('dataQualityUi.statusPresentations.noApplicableTitle'),
      description: i18n.t('dataQualityUi.statusPresentations.noApplicableDescription'),
    };
  }
  const keys = STATUS_PRESENTATION_KEYS[summary.state];
  return {
    title: i18n.t(keys.title),
    ...(keys.description ? { description: i18n.t(keys.description) } : {}),
  };
}

export function getDataQualityCategoryLabel(category: DataQualityCategory): string {
  return i18n.t(DATA_QUALITY_CATEGORY_LABEL_KEYS[category]);
}

export function getDataQualityCategoryDescription(category: DataQualityCategory): string {
  return i18n.t(DATA_QUALITY_CATEGORY_DESCRIPTION_KEYS[category]);
}

export function dataQualityPollingInterval(
  state: DataQualitySummaryState | undefined
): 2000 | false {
  return state === 'QUEUED' || state === 'RUNNING' ? 2_000 : false;
}

export function dataQualityScopeLabel(scope: DataQualityConfig['rules'][number]['scope']): string {
  if (scope.type === 'FIELD') return scope.fieldPath.join('.');
  if (scope.type === 'RELATIONSHIP') return scope.relationshipId;
  return i18n.t('dataQualityUi.dataMartScope');
}

export interface DataQualityRelationshipPresentation {
  titleSuffix?: string;
  scopeLabel: string;
  scopeDetails: string[];
  targetAlias?: string;
}

export function getDataQualityRelationshipPresentation(
  relationshipId: string,
  relationships: readonly unknown[]
): DataQualityRelationshipPresentation {
  const relationshipIdLabel = i18n.t('dataQualityUi.relationshipId', { id: relationshipId });
  const relationship = relationships.find(item => isRecord(item) && item.id === relationshipId);
  if (!isRecord(relationship)) {
    return { scopeLabel: relationshipIdLabel, scopeDetails: [] };
  }

  const targetAlias =
    typeof relationship.targetAlias === 'string' && relationship.targetAlias.trim()
      ? relationship.targetAlias
      : undefined;
  const joinMapping = Array.isArray(relationship.joinConditions)
    ? relationship.joinConditions
        .flatMap(condition => {
          if (!isRecord(condition)) return [];
          const sourceFieldName = condition.sourceFieldName;
          const targetFieldName = condition.targetFieldName;
          if (typeof sourceFieldName !== 'string' || typeof targetFieldName !== 'string') return [];
          return `${sourceFieldName} → ${targetFieldName}`;
        })
        .join(', ')
    : '';

  return {
    ...(targetAlias ? { titleSuffix: targetAlias, targetAlias } : {}),
    scopeLabel: joinMapping || relationshipIdLabel,
    scopeDetails: joinMapping ? [relationshipIdLabel] : [],
  };
}

export function areDataQualityConfigsEqual(
  left: DataQualityConfig | null,
  right: DataQualityConfig | null
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export interface DataQualityFieldRuleGroup {
  fieldPath: string[];
  fieldPathKey: string;
  label: string;
  rules: EffectiveDataQualityRuleConfig[];
}

export interface DataQualitySelectableCheck {
  key: string;
  label: string;
  description: string;
  isAdded: boolean;
}

export interface DataQualitySelectableField {
  fieldPath: string[];
  fieldPathKey: string;
  label: string;
  type?: string;
  checks: DataQualitySelectableCheck[];
}

export function groupDataQualityFieldRules(
  rules: readonly EffectiveDataQualityRuleConfig[]
): DataQualityFieldRuleGroup[] {
  const groups = new Map<string, EffectiveDataQualityRuleConfig[]>();
  const paths = new Map<string, string[]>();

  for (const rule of rules) {
    if (rule.scope.type !== 'FIELD') continue;
    const key = JSON.stringify(rule.scope.fieldPath);
    const group = groups.get(key) ?? [];
    group.push(rule);
    groups.set(key, group);
    paths.set(key, rule.scope.fieldPath);
  }

  return Array.from(groups, ([fieldPathKey, fieldRules]) => {
    const fieldPath = paths.get(fieldPathKey);
    if (!fieldPath) throw new Error(`Missing Data Quality field path for ${fieldPathKey}`);
    return {
      fieldPath: [...fieldPath],
      fieldPathKey,
      label: fieldPath.join('.'),
      rules: fieldRules,
    };
  }).sort(
    (left, right) =>
      left.label.localeCompare(right.label) || left.fieldPathKey.localeCompare(right.fieldPathKey)
  );
}

export function getDisplayedDataQualityFieldRuleKeys(
  baseline: DataQualityConfig | null,
  draft: DataQualityConfig | null
): string[] {
  const displayedRuleKeys = new Set<string>();

  for (const config of [baseline, draft]) {
    for (const rule of config?.rules ?? []) {
      if (rule.enabled && rule.scope.type === 'FIELD') {
        displayedRuleKeys.add(rule.key);
      }
    }
  }

  return Array.from(displayedRuleKeys).sort((left, right) => left.localeCompare(right));
}

export function getSelectableDataQualityFields(
  rules: readonly EffectiveDataQualityRuleConfig[],
  displayedRuleKeys: Iterable<string>
): DataQualitySelectableField[] {
  const displayed = new Set(displayedRuleKeys);

  return groupDataQualityFieldRules(rules)
    .map(group => ({
      fieldPath: [...group.fieldPath],
      fieldPathKey: group.fieldPathKey,
      label: group.label,
      checks: group.rules
        .filter(rule => rule.isApplicable)
        .map(rule => ({
          key: rule.key,
          label: getDataQualityCategoryLabel(rule.category),
          description: getDataQualityCategoryDescription(rule.category),
          isAdded: displayed.has(rule.key),
        })),
    }))
    .filter(field => field.checks.some(check => !check.isAdded));
}

const RESULT_STATUS_ORDER: Record<DataQualityCheckResult['status'], number> = {
  ERROR: 0,
  FAILED: 1,
  PASSED: 2,
  NOT_APPLICABLE: 3,
};

const RESULT_SEVERITY_ORDER: Record<DataQualityCheckResult['severity'], number> = {
  error: 0,
  warning: 1,
  notice: 2,
};

export function sortDataQualityResults(
  results: readonly DataQualityCheckResult[]
): DataQualityCheckResult[] {
  return [...results].sort((left, right) => {
    const statusDifference = RESULT_STATUS_ORDER[left.status] - RESULT_STATUS_ORDER[right.status];
    if (statusDifference !== 0) return statusDifference;

    const severityDifference =
      RESULT_SEVERITY_ORDER[left.severity] - RESULT_SEVERITY_ORDER[right.severity];
    if (severityDifference !== 0) return severityDifference;

    return left.ruleKey.localeCompare(right.ruleKey);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
