import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { visualizer } from 'rollup-plugin-visualizer';

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    basicSsl(),
    mode === 'analyze' &&
      visualizer({
        open: true,
        filename: 'dist/bundle-report.html',
        gzipSize: true,
      }),
  ].filter(Boolean),
  // esbuild >=0.28 errors when lowering some destructuring patterns (styled-components, @base-ui/react,
  // lucide-react, ...) for the Safari 14 target workaround. The target browsers all support destructuring
  // natively, so tell esbuild not to transform it. This must be set in BOTH passes: `esbuild` covers source
  // transform + the production build target, while `optimizeDeps.esbuildOptions` covers the dev-server
  // dependency pre-bundling. Pinned via the root `esbuild` override (GHSA-gv7w-rqvm-qjhr).
  esbuild: {
    supported: {
      destructuring: true,
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      supported: {
        destructuring: true,
      },
    },
  },
  build: {
    minify: mode === 'production',
    sourcemap: mode === 'development',
    rollupOptions: {
      output: {
        // Match resolved module paths instead of package entry names. This is
        // required for subpath imports such as `react-dom/client`, which do not
        // belong to a package-entry-only manual chunk and otherwise inflate the
        // application entry by more than 500 kB.
        manualChunks(id) {
          const moduleId = id.replaceAll('\\', '/');

          if (moduleId.includes('/node_modules/react-dom/')) return 'vendor-react-dom';
          if (moduleId.includes('/node_modules/react/')) return 'vendor-react';
          if (moduleId.includes('/node_modules/react-router')) return 'vendor-router';
          if (moduleId.includes('/node_modules/@tanstack/react-query')) return 'vendor-query';
          if (
            moduleId.includes('/node_modules/i18next') ||
            moduleId.includes('/node_modules/react-i18next')
          ) {
            return 'vendor-i18n';
          }
          if (
            moduleId.includes('/node_modules/react-hook-form') ||
            moduleId.includes('/node_modules/@hookform/resolvers')
          ) {
            return 'vendor-forms';
          }
          if (moduleId.includes('/node_modules/@monaco-editor/react')) return 'vendor-editor';
          if (
            moduleId.includes('/node_modules/@xyflow/react') ||
            moduleId.includes('/node_modules/@dagrejs/dagre')
          ) {
            return 'vendor-flow';
          }
          if (
            moduleId.includes('/node_modules/@dnd-kit/core') ||
            moduleId.includes('/node_modules/@dnd-kit/sortable') ||
            moduleId.includes('/node_modules/@dnd-kit/utilities')
          ) {
            return 'vendor-dnd';
          }
          if (moduleId.includes('/node_modules/zod/')) return 'vendor-validation';
          if (moduleId.includes('/node_modules/tailwind-merge/')) return 'vendor-styling';
          if (moduleId.includes('/src/i18n/locales/')) return 'vendor-locales';

          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
  },
  server: {
    host: '0.0.0.0',
    hmr: {
      overlay: false,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // MCP transport (Streamable HTTP) — lets an external client (Claude Desktop/web,
      // ChatGPT, ...) connect to this single dev-server origin instead of the bare
      // backend port, so the same https://localhost:5173 (or its tunnel URL) works for
      // both the /ui/* pages and the MCP endpoint.
      '/mcp': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // OAuth discovery documents (MCP dynamic client registration, protected-resource
      // metadata) — served at the origin root, no /api prefix (see
      // PROTOCOL_ROUTE_EXCLUSIONS in the backend).
      '/.well-known': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // The actual OAuth 2.0 protocol endpoints backing MCP dynamic client registration.
      // Proxied by exact path, NOT a blanket '/oauth' prefix — this app's own frontend
      // routes live under /oauth/* too (e.g. /oauth/google/callback, oauth.routes.tsx),
      // and a blanket rule would wrongly send those to the backend instead of the SPA.
      '/oauth/authorize': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/oauth/register': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/oauth/token': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/oauth/jwks': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
}));
