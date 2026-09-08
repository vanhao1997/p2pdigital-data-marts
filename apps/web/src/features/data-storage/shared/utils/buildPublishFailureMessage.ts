import i18n from '../../../../i18n';

/**
 * Builds the toast text for drafts that could not be published.
 *
 * `failedCount` comes from the server rather than `reasons.length`: the API
 * returns deduplicated reasons and no per-draft identifiers, because editing a
 * storage does not imply visibility of every Data Mart inside it.
 */
export function buildPublishFailureMessage(failedCount: number, reasons: string[]): string {
  const draftWord =
    failedCount !== 1
      ? i18n.t('uiFeedback.publishFailure.drafts')
      : i18n.t('uiFeedback.publishFailure.draft');
  const pronoun =
    failedCount !== 1
      ? i18n.t('uiFeedback.publishFailure.them')
      : i18n.t('uiFeedback.publishFailure.it');

  // No reasons at all is not the same as differing reasons: during a rolling
  // deploy a trigger completed by the previous backend has no `failureReasons`
  // (they live up to the 1-hour TTL), so stay silent on the cause instead of
  // claiming the drafts failed for different ones.
  const reasonClause =
    reasons.length === 0
      ? ''
      : reasons.length === 1
        ? i18n.t('uiFeedback.publishFailure.sharedReason', { reason: reasons[0] })
        : i18n.t('uiFeedback.publishFailure.differentReasons');

  return i18n.t('uiFeedback.publishFailure.message', {
    count: failedCount,
    draftWord,
    reasonClause,
    pronoun,
  });
}
