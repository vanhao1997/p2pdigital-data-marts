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
import {
  humanizeFieldName,
  isVietnameseLocale,
} from '../../../../shared/utils/field-humanizer';

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
  if (scope.type === 'FIELD') {
    const rawPath = scope.fieldPath.join('.');
    return isVietnameseLocale()
      ? humanizeFieldName(rawPath, { locale: 'vi', includeTechnicalName: true })
      : rawPath;
  }
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
          if (isVietnameseLocale()) {
            const left = humanizeFieldName(sourceFieldName, {
              locale: 'vi',
              includeTechnicalName: true,
            });
            const right = humanizeFieldName(targetFieldName, {
              locale: 'vi',
              includeTechnicalName: true,
            });
            return `${left} → ${right}`;
          }
          return `${sourceFieldName} → ${targetFieldName}`;
        })
        .join(', ')
    : '';

  return {
    ...(targetAlias ? { titleSuffix: targetAlias, targetAlias } : {}),
    scopeLabel: joinMapping || relationshipIdLabel,
    scopeDetails: joinMapping && !isVietnameseLocale() ? [relationshipIdLabel] : [],
  };
}

const DATA_QUALITY_REASON_VI: Readonly<Record<string, string>> = {
  'No primary key fields are configured in the current Output Schema':
    'Chưa cấu hình trường khóa chính (PK) trong Lược đồ đầu ra hiện tại',
  'Nested field is inside a repeated, array, map, or semi-structured container and requires provider-specific flattening':
    'Trường lồng nhau nằm trong cấu trúc lặp (repeated, array, map hoặc bán cấu trúc) và cần làm phẳng theo nhà cung cấp',
  'No connected materialized Output Schema fields are available':
    'Không có trường Lược đồ đầu ra nào đã kết nối để kiểm tra',
  'Field is no longer eligible for Data Freshness':
    'Trường này không còn hợp lệ để kiểm tra Độ mới dữ liệu',
  'Data Mart scope is no longer applicable': 'Phạm vi Data Mart không còn áp dụng được',
  'Field scope no longer exists in the current Output Schema':
    'Trường này không còn tồn tại trong Lược đồ đầu ra hiện tại',
  'Relationship scope no longer exists': 'Mối quan hệ này không còn tồn tại',
  'Relationship target Data Mart is not accessible':
    'Không có quyền truy cập Data Mart đích của mối quan hệ',
  'Relationship has no join conditions': 'Mối quan hệ chưa được cấu hình điều kiện kết nối (Join)',
  'negative_values requires a numeric Output Schema field':
    'Kiểm tra Giá trị âm chỉ áp dụng cho trường kiểu số trong Lược đồ đầu ra',
  'The check is disabled': 'Kiểm tra này đang tắt',
  'The check is not applicable': 'Kiểm tra này không áp dụng được',
};

export function localizeDataQualityReason(
  reason: string | null | undefined
): string | undefined {
  if (!reason) return undefined;
  if (!isVietnameseLocale()) return reason;
  const direct = DATA_QUALITY_REASON_VI[reason];
  if (direct) return direct;
  if (reason.endsWith('requires an Output Schema field that can be canonicalized for grouping')) {
    return 'Kiểm tra này yêu cầu trường trong Lược đồ đầu ra hỗ trợ nhóm (GROUP BY)';
  }
  if (reason.startsWith('Relationship source fields are missing from the current Output Schema: ')) {
    const fields = reason.slice(
      'Relationship source fields are missing from the current Output Schema: '.length
    );
    return `Các trường nguồn của mối quan hệ không còn trong Lược đồ đầu ra hiện tại: ${fields}`;
  }
  if (
    reason.startsWith('Field ') &&
    reason.endsWith(' cannot be canonicalized for duplicate comparison')
  ) {
    const fieldName = reason.slice(
      'Field '.length,
      reason.length - ' cannot be canonicalized for duplicate comparison'.length
    );
    return `Trường ${humanizeFieldName(fieldName, { locale: 'vi', includeTechnicalName: true })} không hỗ trợ chuẩn hóa để so sánh trùng lặp`;
  }
  return reason;
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
