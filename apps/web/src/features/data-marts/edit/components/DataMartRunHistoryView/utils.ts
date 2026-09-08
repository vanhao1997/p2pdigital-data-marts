import {
  formatDateTime,
  formatDuration,
  formatTimestamp,
} from '../../../../../utils/date-formatters';
import { DataMartRunType } from '../../../shared';
import type { DataMartRunItem } from '../../model';
import type { DataMartDefinitionConfig } from '../../model/types/data-mart-definition-config';
import type { LogEntry } from './types';
import { LogLevel } from './types';
import i18n from '../../../../../i18n';
import { localizeOperationalError } from '../../../../../shared/utils/localize-operational-error';

// Mirrors ConnectorMessageType.WARNING ('addWarningToCurrentStatus') from the backend enum —
// the web app has no shared reference to it, since logs/errors arrive as raw JSON strings.
const WARNING_MESSAGE_TYPE = 'addWarningToCurrentStatus';
const OPERATIONAL_WARNING_TYPE = 'warning';
const OPERATIONAL_ERROR_TYPE = 'error';

/**
 * Whether a persisted entry from the run's `errors` array is a classified warning
 * rather than a genuine failure. Both share that array, so any view rendering it has
 * to partition them or it will present warnings as errors.
 */
export const isPersistedWarning = (raw: string): boolean => {
  try {
    const type = (JSON.parse(raw) as { type?: unknown }).type;
    return type === WARNING_MESSAGE_TYPE || type === OPERATIONAL_WARNING_TYPE;
  } catch {
    return false;
  }
};

const resolveLogLevel = (isError: boolean, messageType?: string | null): LogLevel => {
  if (messageType === WARNING_MESSAGE_TYPE || messageType === OPERATIONAL_WARNING_TYPE) {
    return LogLevel.WARNING;
  }
  return isError ? LogLevel.ERROR : LogLevel.INFO;
};

export const parseLogEntry = (log: string, index: number, isError = false): LogEntry => {
  // Split log into lines for multiline format
  const lines = log.split('\n').filter(line => line.trim() !== '');

  if (lines.length >= 3) {
    // Format: timestamp\ntype\nmessage
    const timestamp = lines[0];
    const type = lines[1];
    const message = lines.slice(2).join('\n');

    // Check if timestamp looks like ISO format
    if (timestamp.includes('T') && timestamp.includes('Z')) {
      // Try to parse message as JSON to extract type and at
      const processedMessage = processJSONMessage(message);

      return {
        id: `log-${index.toString()}`,
        timestamp: formatTimestamp(timestamp),
        level: resolveLogLevel(isError, processedMessage.metadata?.type as string | undefined),
        message: processedMessage.message,
        metadata: {
          at: processedMessage.metadata?.at
            ? formatTimestamp(processedMessage.metadata.at as string)
            : formatTimestamp(timestamp),
          type: processedMessage.metadata?.type ?? (type !== 'unknown' ? type : null),
        },
      };
    }
  }

  const structuredMatch = /^\[(.*?)\]\s*\[(.*?)\]\s*(.*)$/.exec(log);
  if (structuredMatch) {
    const processedMessage = processJSONMessage(structuredMatch[3]);

    return {
      id: `log-${index.toString()}`,
      timestamp: formatTimestamp(structuredMatch[1]),
      level:
        processedMessage.metadata?.type === WARNING_MESSAGE_TYPE
          ? LogLevel.WARNING
          : isError
            ? LogLevel.ERROR
            : (structuredMatch[2] as LogLevel),
      message: processedMessage.message,
      metadata: processedMessage.metadata?.at
        ? {
            ...processedMessage.metadata,
            at: formatTimestamp(processedMessage.metadata.at as string),
          }
        : processedMessage.metadata,
    };
  }

  // Fallback for simple logs
  const processedMessage = processJSONMessage(log);
  return {
    id: `log-${index.toString()}`,
    timestamp: 'N/A',
    level: resolveLogLevel(isError, processedMessage.metadata?.type as string | undefined),
    message: processedMessage.message,
    metadata: processedMessage.metadata?.at
      ? {
          ...processedMessage.metadata,
          at: formatTimestamp(processedMessage.metadata.at as string),
        }
      : processedMessage.metadata,
  };
};

export const processJSONMessage = (
  message: string
): { message: string; metadata?: Record<string, string | number | boolean | null> } => {
  try {
    const parsed = JSON.parse(message) as unknown;

    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      const record = parsed as Record<string, unknown>;
      const metadata: Record<string, string | number | boolean | null> = {};
      const processedObj = { ...record };

      // Extract type and at fields
      if (typeof processedObj.type === 'string') {
        metadata.type = processedObj.type;
        delete processedObj.type;
      }

      if (typeof processedObj.at === 'string') {
        metadata.at = processedObj.at;
        delete processedObj.at;
      }

      if (typeof processedObj.code === 'string') {
        metadata.code = processedObj.code;
      }

      const localizedOperationalError = localizeOperationalError(record);
      if (localizedOperationalError) {
        return {
          message: localizedOperationalError,
          metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        };
      }

      // If only one field remains, show it as plain text
      const remainingKeys = Object.keys(processedObj);
      if (remainingKeys.length === 1) {
        const key = remainingKeys[0];
        const value = processedObj[key];
        return {
          message: typeof value === 'string' ? value : JSON.stringify(value),
          metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        };
      }

      // If multiple fields remain, show as JSON
      return {
        message: JSON.stringify(processedObj, null, 2),
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      };
    }
  } catch {
    // Not valid JSON, return as is
  }

  return { message };
};

export const getDisplayType = (logEntry: LogEntry): string => {
  if (
    logEntry.metadata?.type === WARNING_MESSAGE_TYPE ||
    logEntry.metadata?.type === OPERATIONAL_WARNING_TYPE
  ) {
    return i18n.t('runHistory.warning');
  }
  if (logEntry.metadata?.type === OPERATIONAL_ERROR_TYPE) return i18n.t('runHistory.error');
  if (logEntry.metadata?.type) {
    return logEntry.metadata.type as string;
  }
  return logEntry.level;
};

export const getRunSummaryParts = (
  run: DataMartRunItem,
  connectorDisplayName: string | null | undefined
) => {
  let title = '';
  let runType = '';
  switch (run.type) {
    case DataMartRunType.CONNECTOR:
      title = connectorDisplayName ?? '';
      runType = 'connector';
      break;
    case DataMartRunType.LOOKER_STUDIO:
      title = i18n.t('runHistory.dataStudioDataFetching');
      runType = 'report';
      break;
    case DataMartRunType.GOOGLE_SHEETS_EXPORT:
    case DataMartRunType.EXCEL:
    case DataMartRunType.EMAIL:
    case DataMartRunType.SLACK:
    case DataMartRunType.MS_TEAMS:
    case DataMartRunType.GOOGLE_CHAT:
      title = run.reportDefinition?.title ?? '';
      runType = 'report';
      break;
    case DataMartRunType.INSIGHT:
      title = run.insightDefinition?.title ?? '';
      runType = 'insight';
      break;
    case DataMartRunType.INSIGHT_TEMPLATE:
      title = run.insightTemplateDefinition?.title ?? '';
      runType = 'insightTemplate';
      break;
    case DataMartRunType.AI_ASSISTANT:
      title = run.aiAssistantDefinition?.route ?? '';
      runType = 'aiAssistant';
      break;
    case DataMartRunType.HTTP_DATA:
      runType = 'httpData';
      break;
    case DataMartRunType.MCP_QUERY:
      runType = 'mcpQuery';
      break;
    case DataMartRunType.DATA_QUALITY:
      runType = 'dataQuality';
      title = getDataQualitySummaryLabel(run);
      break;
    default:
      break;
  }

  const runDescription = i18n.t('runHistory.runDescription', {
    trigger: i18n.t(`runHistory.triggerTypes.${run.triggerType}`, {
      defaultValue: run.triggerType,
    }),
    runType: i18n.t(`runHistory.runTypes.${runType}`, { defaultValue: runType }),
  });

  return [runDescription, title];
};

function getDataQualitySummaryLabel(run: DataMartRunItem): string {
  const summary = run.qualitySummary;
  if (!summary) return '';
  if (summary.totalChecks > 0 && summary.notApplicableChecks === summary.totalChecks) {
    return i18n.t('runHistory.qualitySummary.notApplicable');
  }

  const findingCount = summary.errorFindings + summary.warningFindings + summary.noticeFindings;
  if (findingCount > 0) {
    return i18n.t(
      findingCount === 1
        ? 'runHistory.qualitySummary.findingSingular'
        : 'runHistory.qualitySummary.findingPlural',
      { count: findingCount }
    );
  }
  switch (summary.state) {
    case 'PASSED':
      return summary.totalChecks > 0
        ? i18n.t('runHistory.qualitySummary.checksPassed', {
            passed: summary.passedChecks,
            total: summary.totalChecks,
          })
        : i18n.t('runHistory.qualitySummary.allChecksPassed');
    case 'QUEUED':
      return i18n.t('runHistory.qualitySummary.queued');
    case 'RUNNING':
      return i18n.t('runHistory.qualitySummary.running');
    case 'EXECUTION_FAILED':
      return i18n.t('runHistory.qualitySummary.partialResults');
    case 'RESTRICTED':
      return i18n.t('runHistory.qualitySummary.restricted');
    case 'CANCELLED':
      return i18n.t('runHistory.qualitySummary.partialResultsKept');
    case 'ALL_DISABLED':
      return i18n.t('runHistory.qualitySummary.allChecksDisabled');
    case 'NEVER_RUN':
      return i18n.t('runHistory.qualitySummary.neverRun');
    default:
      return '';
  }
}

export const downloadLogs = (run: {
  id: string;
  logs: string[];
  errors: string[];
  definitionRun: DataMartDefinitionConfig | null;
}) => {
  const blob = new Blob([JSON.stringify(run, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `datamart-run-${run.id.slice(0, 8)}-logs.json`;
  a.click();
  URL.revokeObjectURL(url);
};

export const getStartedAtDisplay = (run: DataMartRunItem): string => {
  const resolvedDate = run.startedAt ?? run.createdAt;
  return formatDateTime(resolvedDate.toISOString());
};

export const getTooltipContent = (run: DataMartRunItem) => {
  const startedAt = formatDateForTooltipContent(run.startedAt);
  const finishedAt = formatDateForTooltipContent(run.finishedAt);

  let duration = '';
  if (run.startedAt && run.finishedAt) {
    duration = formatDuration(run.startedAt, run.finishedAt);
  }

  return {
    startedAt,
    finishedAt,
    duration,
  };
};

export const formatDateForTooltipContent = (date: Date | null): string => {
  return date ? formatDateTime(date.toISOString()) : 'N/A';
};
