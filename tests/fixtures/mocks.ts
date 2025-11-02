/**
 * Mock implementations for external dependencies
 */

export const mockFileService = {
  read: jest.fn(),
  readMetadata: jest.fn(),
  write: jest.fn(),
  delete: jest.fn(),
  backup: jest.fn(),
  restore: jest.fn(),
  extract: jest.fn(),
  analyze: jest.fn()
};

export const mockAIService = {
  chat: jest.fn(),
  extract: jest.fn(),
  summarize: jest.fn(),
  embed: jest.fn(),
  embedBatch: jest.fn(),
  classify: jest.fn()
};

export const mockMatchService = {
  findMatches: jest.fn(),
  findMatchesBatch: jest.fn(),
  scoreMatch: jest.fn(),
  recordCorrection: jest.fn(),
  getLearnedRules: jest.fn()
};

export const mockRAGService = {
  store: jest.fn(),
  storeBatch: jest.fn(),
  search: jest.fn(),
  searchSimilar: jest.fn(),
  recordPattern: jest.fn(),
  getPatterns: jest.fn(),
  recordVendorAlias: jest.fn(),
  getVendorAliases: jest.fn(),
  prune: jest.fn()
};

export const mockWorkflowService = {
  start: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  cancel: jest.fn(),
  getStatus: jest.fn(),
  getTemplates: jest.fn()
};

export const mockDatabase = {
  prepare: jest.fn(() => ({
    run: jest.fn(),
    get: jest.fn(),
    all: jest.fn()
  })),
  exec: jest.fn(),
  close: jest.fn()
};

export const mockElectron = {
  app: {
    getPath: jest.fn(() => '/test/path'),
    getName: jest.fn(() => 'intelligent-finder-test')
  },
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn()
  },
  BrowserWindow: jest.fn()
};

/**
 * Reset all mocks
 */
export const resetAllMocks = () => {
  Object.values(mockFileService).forEach(fn => fn.mockReset());
  Object.values(mockAIService).forEach(fn => fn.mockReset());
  Object.values(mockMatchService).forEach(fn => fn.mockReset());
  Object.values(mockRAGService).forEach(fn => fn.mockReset());
  Object.values(mockWorkflowService).forEach(fn => fn.mockReset());
};
