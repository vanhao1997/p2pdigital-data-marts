interface ErrorReport {
  message: string;
  stack?: string;
  componentStack?: string;
  url: string;
  timestamp: string;
  userAgent: string;
}

const MAX_ERRORS_PER_SESSION = 10;
let errorCount = 0;

export function reportError(error: Error, componentStack?: string): void {
  if (errorCount >= MAX_ERRORS_PER_SESSION) return;
  errorCount++;

  const report: ErrorReport = {
    message: error.message,
    stack: error.stack,
    componentStack,
    url: window.location.href,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
  };

  if (import.meta.env.DEV) {
    console.error('[Error Reporter]', report);
    return;
  }

  const endpoint = (import.meta.env as unknown as Record<string, string | undefined>)
    .VITE_ERROR_REPORTING_ENDPOINT;
  if (endpoint) {
    fetch(`${endpoint}/errors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
    }).catch(() => undefined);
  }
}

export function initGlobalErrorHandlers(): void {
  window.addEventListener('error', event => {
    reportError(event.error instanceof Error ? event.error : new Error(event.message));
  });

  window.addEventListener('unhandledrejection', event => {
    const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
    reportError(error);
  });
}
