import { config as nodeConfig } from '@owox/eslint-config/node';

export default [
  ...nodeConfig,
  {
    ignores: [
      // service dirs
      '.git/',
      '.github/',
      '.husky/',
      'node_modules/',
      'dist/',
      'build/',
      'coverage/',
      'output/',
      '.tmp*/',
      '.playwright-cli/',
      'playwright-report/',
      'test-results/',

      // workspaces
      'packages/*',
      'apps/*',
    ],
  },
];
