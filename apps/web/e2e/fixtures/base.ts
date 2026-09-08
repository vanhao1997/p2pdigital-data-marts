import { test as base, expect, type Locator } from '@playwright/test';
import { ApiHelpers, resetDatabase } from './api-helpers';
import { RadixHelpers } from '../helpers/radix';

export const test = base.extend<{
  authenticated: undefined;
  apiHelpers: ApiHelpers;
  radix: RadixHelpers;
}>({
  authenticated: [
    async ({ page }, provideFixture) => {
      // The standalone browser backend uses NullIdpProvider. Seed its cookie
      // before each test so protected UI routes do not redirect to sign-in.
      const response = await page.request.get('/auth/sign-in?projectId=0', {
        maxRedirects: 0,
      });
      if (response.status() < 300 || response.status() >= 400) {
        throw new Error(`Browser E2E sign-in bootstrap failed: HTTP ${response.status()}`);
      }
      await provideFixture(undefined);
    },
    { auto: true },
  ],
  apiHelpers: async ({ page }, provideFixture) => {
    // Reset DB before each test to prevent data leakage between specs
    resetDatabase();
    await provideFixture(new ApiHelpers(page));
  },
  radix: async ({ page }, provideFixture) => {
    await provideFixture(new RadixHelpers(page));
  },
});

export { expect, type Locator };
