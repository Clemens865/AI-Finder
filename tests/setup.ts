/**
 * Global test setup file
 * Runs before all tests
 */

import '@testing-library/jest-dom';

// Suppress console warnings in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock electron in Node environment
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => '/tmp/test'),
    getName: jest.fn(() => 'intelligent-finder-test'),
  },
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn(),
  },
  BrowserWindow: jest.fn(),
}));

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

// Global test timeout
jest.setTimeout(10000);
