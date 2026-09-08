import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'happy-dom',
    // Otherwise happy-dom really fetches any iframe src a test renders, which turns a
    // pure attribute assertion into a network call.
    environmentOptions: {
      happyDOM: {
        settings: {
          disableCSSFileLoading: true,
          disableIframePageLoading: false,
          disableJavaScriptFileLoading: true,
          handleDisabledFileLoadingAsSuccess: true,
          navigation: {
            disableChildFrameNavigation: true,
          },
        },
      },
    },
    globals: true,
    setupFiles: [resolve(__dirname, 'src/test/setup.ts')],
    exclude: ['e2e/**', 'node_modules/**'],
  },
});
