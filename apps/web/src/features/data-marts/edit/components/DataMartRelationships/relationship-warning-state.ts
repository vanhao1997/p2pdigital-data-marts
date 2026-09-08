export const CYCLE_STUB_TOOLTIP = 'dataMartRelationships.cycleStubTooltip';

export const MISSING_PRIMARY_KEY_TOOLTIP = 'dataMartRelationships.missingPrimaryKeyTooltip';

type RelationshipTranslator = (key: string, fallback: string) => string;

interface RelationshipWarningFlags {
  isCycleStub?: boolean;
  isDraft?: boolean;
  isJoinNotConfigured?: boolean;
  isBlocked?: boolean;
  isMissingPrimaryKey?: boolean;
}

/**
 * 'warning' = non-functional (Loop / Draft / Join not configured / Blocked).
 * 'attention' = functional, heads-up only (e.g. missing primary key). Extensible for future
 * attention-only flags — just return kind: 'attention' for them below.
 */
export type RelationshipIndicatorKind = 'warning' | 'attention';

export interface RelationshipIndicator {
  label: string;
  kind: RelationshipIndicatorKind;
}

export function getRelationshipIndicator(
  flags: RelationshipWarningFlags,
  translate?: RelationshipTranslator
): RelationshipIndicator | null {
  const label = (key: string, fallback: string) => translate?.(key, fallback) ?? fallback;
  if (flags.isCycleStub)
    return { label: label('dataMartRelationships.loop', 'Loop'), kind: 'warning' };
  if (flags.isDraft)
    return { label: label('dataMartRelationships.draft', 'Draft'), kind: 'warning' };
  if (flags.isJoinNotConfigured)
    return {
      label: label('dataMartRelationships.joinNotConfigured', 'Join not configured'),
      kind: 'warning',
    };
  if (flags.isBlocked)
    return { label: label('dataMartRelationships.blocked', 'Blocked'), kind: 'warning' };
  if (flags.isMissingPrimaryKey)
    return {
      label: label('dataMartRelationships.noPrimaryKey', 'No primary key'),
      kind: 'attention',
    };
  return null;
}

/** True only when the endpoint carries a WARNING-kind indicator (non-functional). Drives the node border. */
export function hasNodeWarning(flags: RelationshipWarningFlags): boolean {
  return getRelationshipIndicator(flags)?.kind === 'warning';
}

/** Edge/connection carries the warning color only for WARNING-kind endpoints — attention-kind (e.g. missing-PK) stays unstyled since the join still works. */
export function hasConnectionWarning(
  source: RelationshipWarningFlags | undefined,
  target: RelationshipWarningFlags | undefined
): boolean {
  return hasNodeWarning(source ?? {}) || hasNodeWarning(target ?? {});
}

// The fan-out (double-count) risk only exists once a join is configured.
export function isMissingPrimaryKeyWarning(
  hasPrimaryKey: boolean | undefined,
  joinConditionsCount: number
): boolean {
  return hasPrimaryKey === false && joinConditionsCount > 0;
}
