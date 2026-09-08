import type {
  AiAssistantMessageDto,
  AiAssistantSessionListItemDto,
  ApplyAiAssistantSessionResponseDto,
} from '../types/ai-assistant.dto.ts';
import type {
  ApplyChangesMessageAction,
  AssistantMessageDetails,
  CreateAndAttachMessageAction,
} from '../types/ai-assistant-panel.types.ts';
import i18n from '../../../../../../i18n';

export function formatSessionTitle(
  session: Pick<AiAssistantSessionListItemDto, 'title' | 'createdAt'>
): string {
  const normalized = (session.title ?? '').trim();
  if (normalized) {
    return normalized;
  }

  const createdAt = new Date(session.createdAt);
  if (Number.isNaN(createdAt.getTime())) {
    return i18n.t('insightsUi.newChat');
  }

  return i18n.t('insightsUi.newChatWithDate', {
    date: createdAt.toLocaleDateString(),
  });
}

export function buildAssistantMessageDetails(
  message: AiAssistantMessageDto
): AssistantMessageDetails {
  const proposedActions = Array.isArray(message.proposedActions) ? message.proposedActions : [];
  const sqlCandidate = message.sqlCandidate?.trim() ?? '';
  const applyChangesAction = (proposedActions.find(
    action => action.type === 'apply_changes_to_source' || action.type === 'apply_sql_to_artifact'
  ) ?? null) as ApplyChangesMessageAction | null;
  const createSourceAndAttachAction = (proposedActions.find(
    action =>
      action.type === 'create_source_and_attach' || action.type === 'attach_source_to_template'
  ) ?? null) as CreateAndAttachMessageAction | null;
  const insertIntoTemplateAction =
    proposedActions.find(action => action.type === 'reuse_source_without_changes') ?? null;
  const applyTemplateEditAction =
    proposedActions.find(action => action.type === 'replace_template_document') ?? null;
  const templateEditPayloadAction =
    applyTemplateEditAction ??
    createSourceAndAttachAction ??
    applyChangesAction ??
    insertIntoTemplateAction;

  let hasTemplateEditPayload = false;
  if (templateEditPayloadAction) {
    const payload = templateEditPayloadAction.payload;
    hasTemplateEditPayload = Boolean(payload.text?.trim() && Array.isArray(payload.tags));
  }

  return {
    sqlCandidate,
    applyChangesAction,
    createAndAttachAction: createSourceAndAttachAction,
    insertIntoTemplateAction,
    applyTemplateEditAction,
    hasTemplateEditPayload,
    hasActions: Boolean(
      applyChangesAction?.id ??
      createSourceAndAttachAction?.id ??
      insertIntoTemplateAction?.id ??
      applyTemplateEditAction?.id
    ),
  };
}

export function formatApplyStatusMessage(result: ApplyAiAssistantSessionResponseDto): string {
  switch (result.status) {
    case 'updated':
      return formatUpdatedApplyMessage(result.reason);
    case 'already_present':
    case 'already_exists':
      return i18n.t('insightsUi.aiAssistantMessages.snippetAlreadyExists');
    case 'no_op':
      return formatNoOpApplyMessage(result.reason);
    case 'validation_failed':
      return i18n.t('insightsUi.aiAssistantMessages.templateValidationFailed');
    default:
      return i18n.t('insightsUi.aiAssistantMessages.applyFinished');
  }
}

function formatUpdatedApplyMessage(reason: string | null): string {
  if (reason === 'update_existing_source') {
    return i18n.t('insightsUi.aiAssistantMessages.sourceSqlUpdated');
  }

  if (reason === 'create_and_attach_source') {
    return i18n.t('insightsUi.aiAssistantMessages.sourceCreatedAttached');
  }

  if (reason === 'attach_existing_source') {
    return i18n.t('insightsUi.aiAssistantMessages.existingSourceAttached');
  }

  if (reason === 'replace_template_document') {
    return i18n.t('insightsUi.aiAssistantMessages.templateUpdated');
  }

  if (reason === 'remove_source_only') {
    return i18n.t('insightsUi.aiAssistantMessages.sourceRemoved');
  }

  return i18n.t('insightsUi.aiAssistantMessages.applyUpdated');
}

function formatNoOpApplyMessage(reason: string | null): string {
  if (reason === 'template_full_replace_no_changes') {
    return i18n.t('insightsUi.aiAssistantMessages.templateAlreadyUpToDate');
  }

  return i18n.t('insightsUi.aiAssistantMessages.noChangesApplied');
}
