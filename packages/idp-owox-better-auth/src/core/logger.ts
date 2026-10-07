import { LoggerFactory, type Logger } from '@owox/internal-helpers';
import {
  sanitizeLogMessage,
  sanitizeLogMeta,
  summarizeBetterAuthArgs,
} from '../utils/log-sanitizer.js';

export function createServiceLogger(serviceName: string): Logger {
  return createSanitizingLogger(LoggerFactory.createNamedLogger(`IDP:${serviceName}`));
}

function createSanitizingLogger(logger: Logger): Logger {
  return {
    debug: (message, meta) =>
      logger.debug(sanitizeLogMessage(message), meta ? sanitizeLogMeta(meta) : undefined),
    info: (message, meta) =>
      logger.info(sanitizeLogMessage(message), meta ? sanitizeLogMeta(meta) : undefined),
    warn: (message, meta, exception) =>
      logger.warn(
        sanitizeLogMessage(message),
        meta ? sanitizeLogMeta(meta) : undefined,
        sanitizeLogException(exception)
      ),
    error: (message, meta, exception) =>
      logger.error(
        sanitizeLogMessage(message),
        meta ? sanitizeLogMeta(meta) : undefined,
        sanitizeLogException(exception)
      ),
    trace: (message, meta) =>
      logger.trace(sanitizeLogMessage(message), meta ? sanitizeLogMeta(meta) : undefined),
    log: (level, message, meta, exception) =>
      logger.log(
        level,
        sanitizeLogMessage(message),
        meta ? sanitizeLogMeta(meta) : undefined,
        sanitizeLogException(exception)
      ),
  };
}

function sanitizeLogException(exception: Error | unknown): Error | unknown {
  if (!exception) return exception;

  if (exception instanceof Error) {
    const sanitized = new Error(sanitizeLogMessage(exception.message));
    sanitized.name = exception.name;
    if (exception.stack) {
      sanitized.stack = sanitizeLogMessage(exception.stack);
    }
    return sanitized;
  }

  if (Array.isArray(exception)) {
    return summarizeBetterAuthArgs(exception);
  }

  if (typeof exception === 'object') {
    return sanitizeLogMeta(exception as Record<string, unknown>);
  }

  if (typeof exception === 'string') {
    return sanitizeLogMessage(exception);
  }

  return exception;
}
