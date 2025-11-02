import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'path';

/**
 * Playwright configuration for E2E testing with Electron
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e',

  /* Maximum time one test can run for */
  timeout: 120 * 1000,

  /* Run tests in files in parallel */
  fullyParallel: false,

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Reporter to use */
  reporter: [
    ['html', { outputFolder: 'tests/reports/e2e-html' }],
    ['json', { outputFile: 'tests/reports/e2e-results.json' }],
    ['junit', { outputFile: 'tests/reports/e2e-junit.xml' }],
    ['list']
  ],

  /* Shared settings for all the projects below */
  use: {
    /* Collect trace when retrying the failed test */
    trace: 'on-first-retry',

    /* Screenshot on failure */
    screenshot: 'only-on-failure',

    /* Video on failure */
    video: 'retain-on-failure',

    /* Base URL for web tests (if needed) */
    // baseURL: 'http://localhost:3000',
  },

  /* Configure projects for Electron */
  projects: [
    {
      name: 'electron',
      testMatch: /.*\.e2e\.ts/,
      use: {
        // Electron-specific configuration
        launchOptions: {
          executablePath: resolve(__dirname, 'node_modules/.bin/electron'),
          args: [resolve(__dirname, 'dist/main/index.js')]
        }
      }
    }
  ],

  /* Folder for test artifacts such as screenshots, videos, traces, etc. */
  outputDir: 'tests/reports/artifacts',
});
