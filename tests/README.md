# Intelligent Finder - Testing Documentation

## Overview

Comprehensive test suite for the Intelligent Finder application with >80% code coverage target.

## Test Structure

```
tests/
├── unit/                    # Unit tests (fast, isolated)
│   ├── services/           # Service layer tests
│   ├── components/         # React component tests
│   └── utils/              # Utility function tests
├── integration/            # Integration tests (slower, multi-component)
│   ├── workflows/          # Workflow integration tests
│   └── file-ops/           # File operation integration
├── e2e/                    # End-to-end tests (Playwright)
│   ├── scenarios/          # User journey scenarios
│   └── page-objects/       # Page object models
├── performance/            # Performance benchmarks
├── fixtures/               # Test data and mocks
│   ├── test-data.ts       # Data generators
│   └── mocks.ts           # Mock implementations
├── setup.ts               # Global test setup
├── setup-dom.ts           # DOM test setup
└── README.md              # This file
```

## Running Tests

### All Tests
```bash
npm test
```

### Unit Tests Only
```bash
npm run test:unit
```

### Component Tests Only
```bash
npm run test:unit -- --testPathPattern=components
```

### Integration Tests
```bash
npm run test:integration
```

### E2E Tests
```bash
npm run test:e2e

# With UI mode for debugging
npm run test:e2e:ui

# Debug mode
npm run test:e2e:debug
```

### Performance Benchmarks
```bash
npm run test:performance
```

### Watch Mode (for TDD)
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

## Test Coverage Requirements

The project enforces minimum coverage thresholds:

- **Statements**: 80%
- **Branches**: 80%
- **Functions**: 80%
- **Lines**: 80%

View coverage report:
```bash
npm run test:coverage
open coverage/index.html
```

## Writing Tests

### Unit Tests

Unit tests should be fast, isolated, and test a single unit of functionality.

**Example:**
```typescript
// tests/unit/services/file-service.test.ts
import { describe, it, expect, beforeEach } from '@jest/globals';
import { FileService } from '@/services/FileService';

describe('FileService', () => {
  let fileService: FileService;

  beforeEach(() => {
    fileService = new FileService();
  });

  describe('read', () => {
    it('should read file content successfully', async () => {
      const result = await fileService.read('/test/file.pdf');
      expect(result).toHaveProperty('content');
    });

    it('should throw error for invalid path', async () => {
      await expect(fileService.read('')).rejects.toThrow();
    });
  });
});
```

### Component Tests

Component tests use React Testing Library and test user interactions.

**Example:**
```typescript
// tests/unit/components/Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@/components/Button';

describe('Button', () => {
  it('should render with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('should call onClick when clicked', () => {
    const onClick = jest.fn();
    render(<Button onClick={onClick}>Click</Button>);

    fireEvent.click(screen.getByText('Click'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
```

### Integration Tests

Integration tests verify multiple components working together.

**Example:**
```typescript
// tests/integration/workflows/tax-workflow.test.ts
describe('Tax Workflow', () => {
  it('should complete end-to-end workflow', async () => {
    const workflow = new TaxWorkflow(services);

    const result = await workflow.execute({
      invoicesPath: '/test/invoices',
      transactionsPath: '/test/transactions.csv'
    });

    expect(result.matched).toBeGreaterThan(0);
    expect(result.accuracy).toBeGreaterThan(0.8);
  });
});
```

### E2E Tests

E2E tests use Playwright to test the full application.

**Example:**
```typescript
// tests/e2e/scenarios/user-workflow.e2e.ts
import { test, expect } from '@playwright/test';

test('complete tax workflow', async ({ page }) => {
  await page.goto('/');

  await page.click('[data-testid="tax-workflow-button"]');
  await page.fill('[data-testid="invoices-input"]', '/test/invoices');
  await page.click('[data-testid="start-button"]');

  await page.waitForSelector('[data-testid="workflow-complete"]');

  const accuracy = await page.textContent('[data-testid="accuracy"]');
  expect(parseFloat(accuracy)).toBeGreaterThan(80);
});
```

### Performance Tests

Performance tests benchmark critical operations.

**Example:**
```typescript
// tests/performance/benchmarks.test.ts
describe('Performance', () => {
  it('should process 100 files in under 1 second', async () => {
    const start = performance.now();

    await processFiles(files);

    const duration = performance.now() - start;
    expect(duration).toBeLessThan(1000);
  });
});
```

## Test Data and Fixtures

Use the provided fixtures for consistent test data:

```typescript
import {
  generateFileMetadata,
  generateInvoiceData,
  generateTransactionData,
  mockPDFContent
} from '@tests/fixtures/test-data';

const file = generateFileMetadata();
const invoice = generateInvoiceData();
const transaction = generateTransactionData();
```

## Mocking

### Mock Services

```typescript
import { mockFileService } from '@tests/fixtures/mocks';

mockFileService.read.mockResolvedValue({ content: 'test' });
```

### Mock Electron APIs

```typescript
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => '/test/path')
  }
}));
```

## Best Practices

### 1. Test Naming

Use descriptive test names that explain what is being tested:

```typescript
// ✅ Good
it('should throw error when path is empty', async () => { ... });

// ❌ Bad
it('test path', async () => { ... });
```

### 2. Arrange-Act-Assert Pattern

```typescript
it('should calculate confidence score', () => {
  // Arrange
  const match = generateMatch();
  const scorer = new ConfidenceScorer();

  // Act
  const score = scorer.calculate(match);

  // Assert
  expect(score).toBeGreaterThan(0.7);
});
```

### 3. Test One Thing

Each test should verify one specific behavior:

```typescript
// ✅ Good - separate tests
it('should validate email format', () => { ... });
it('should reject empty email', () => { ... });

// ❌ Bad - testing multiple things
it('should validate email', () => {
  // tests format AND empty AND special characters
});
```

### 4. Avoid Test Interdependence

Tests should be independent and runnable in any order:

```typescript
// ✅ Good - each test sets up its own data
beforeEach(() => {
  data = generateTestData();
});

// ❌ Bad - tests depend on execution order
let sharedData;
it('first test', () => { sharedData = ...; });
it('second test', () => { use(sharedData); });
```

### 5. Use Appropriate Timeouts

```typescript
// Short timeout for unit tests
jest.setTimeout(5000);

// Longer timeout for integration tests
jest.setTimeout(30000);

// E2E tests may need even longer
test.setTimeout(120000);
```

## Debugging Tests

### Debug Single Test

```bash
# Jest
npm test -- --testNamePattern="should read file"

# Playwright
npm run test:e2e -- --grep="should complete workflow"
```

### Debug in VS Code

Add breakpoint and run with debugger:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Current File",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["${fileBasename}", "--runInBand"],
  "console": "integratedTerminal"
}
```

### View Test Output

```bash
# Verbose output
npm test -- --verbose

# Show all console logs
npm test -- --silent=false
```

## Continuous Integration

Tests run automatically on:
- Every push to any branch
- All pull requests
- Scheduled nightly runs

CI will fail if:
- Any test fails
- Coverage drops below 80%
- Performance benchmarks exceed thresholds

## Performance Benchmarks

Current performance targets:

| Operation | Target | Current |
|-----------|--------|---------|
| Read 100 files | <1s | TBD |
| Extract 50 PDFs | <5s | TBD |
| Match 50 invoices | <10s | TBD |
| Full workflow (50) | <60s | TBD |
| Vector insert (1000) | <2s | TBD |
| Vector search (1000) | <5s | TBD |

## Troubleshooting

### Tests Fail Locally But Pass in CI

- Check Node version matches CI
- Clear `node_modules` and reinstall
- Check for uncommitted test files

### Slow Tests

- Use `--runInBand` to run serially
- Check for missing async/await
- Profile with `--detectLeaks`

### Flaky Tests

- Check for race conditions
- Add proper `waitFor` statements
- Increase timeouts if needed
- Use `jest.retryTimes(3)` for known flaky tests

### Memory Issues

- Run with `--logHeapUsage`
- Force garbage collection: `node --expose-gc`
- Check for memory leaks with `--detectLeaks`

## Contributing

When adding new features:

1. Write tests first (TDD)
2. Ensure >80% coverage for new code
3. Add performance benchmarks for critical paths
4. Update this README if adding new test patterns

## Resources

- [Jest Documentation](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/react)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Best Practices](https://testingjavascript.com/)
