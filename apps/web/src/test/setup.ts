import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import i18n from '../i18n';
import { setI18n } from 'react-i18next';
import { server } from './mocks/server';

setI18n(i18n);

beforeAll(() => {
  const happyDOM = (
    window as typeof window & {
      happyDOM?: {
        settings: {
          disableCSSFileLoading: boolean;
          disableIframePageLoading: boolean;
          disableJavaScriptFileLoading: boolean;
          handleDisabledFileLoadingAsSuccess: boolean;
          navigation: {
            disableChildFrameNavigation: boolean;
          };
        };
      };
    }
  ).happyDOM;
  if (happyDOM) {
    happyDOM.settings.disableCSSFileLoading = true;
    happyDOM.settings.disableIframePageLoading = false;
    happyDOM.settings.disableJavaScriptFileLoading = true;
    happyDOM.settings.handleDisabledFileLoadingAsSuccess = true;
    happyDOM.settings.navigation.disableChildFrameNavigation = true;
  }

  server.listen({
    onUnhandledRequest: request => {
      const hostname = new URL(request.url).hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
        throw new Error(`Unhandled application request: ${request.method} ${request.url}`);
      }
    },
  });
});

beforeEach(async () => {
  await i18n.changeLanguage('en');
  localStorage.removeItem('p2p_language');
});

afterAll(() => {
  server.close();
});

afterEach(async () => {
  server.resetHandlers();
  // Keep tests deterministic when a language-switching test leaves i18n in Vietnamese.
  await i18n.changeLanguage('en');
  localStorage.removeItem('p2p_language');
});
