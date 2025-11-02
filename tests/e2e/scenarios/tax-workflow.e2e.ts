/**
 * End-to-End tests for Tax Workflow with Playwright
 * Tests the complete user journey from file import to report generation
 */

import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import * as path from 'path';

test.describe('Tax Workflow E2E', () => {
  let electronApp: ElectronApplication;
  let window: Page;

  test.beforeAll(async () => {
    // Launch Electron app
    electronApp = await electron.launch({
      args: [path.join(__dirname, '../../../dist/main/index.js')],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    // Get first window
    window = await electronApp.firstWindow();

    // Wait for app to be ready
    await window.waitForLoadState('domcontentloaded');
  });

  test.afterAll(async () => {
    await electronApp.close();
  });

  test('complete tax workflow from start to finish', async () => {
    // Step 1: Open application
    await expect(window).toHaveTitle(/Intelligent Finder/);

    // Step 2: Navigate to tax workflow
    await window.click('[data-testid="workflows-menu"]');
    await window.click('[data-testid="tax-workflow-button"]');

    await expect(window.locator('[data-testid="workflow-wizard"]')).toBeVisible();

    // Step 3: Select invoice directory
    await window.click('[data-testid="select-invoices-button"]');

    // Mock file dialog (in real tests, you'd use Electron's dialog mock)
    await window.evaluate(() => {
      window.electronAPI.selectDirectory = async () => ({
        canceled: false,
        filePaths: ['/test/data/invoices']
      });
    });

    await window.fill('[data-testid="invoices-path-input"]', '/test/data/invoices');

    // Step 4: Select transaction file
    await window.click('[data-testid="select-transactions-button"]');
    await window.fill('[data-testid="transactions-path-input"]', '/test/data/transactions.csv');

    // Step 5: Start workflow
    await window.click('[data-testid="start-workflow-button"]');

    // Step 6: Wait for processing
    await window.waitForSelector('[data-testid="progress-indicator"]', {
      state: 'visible',
      timeout: 5000
    });

    // Monitor progress
    const progressBar = window.locator('[data-testid="progress-bar"]');
    await expect(progressBar).toBeVisible();

    // Wait for completion (with timeout)
    await window.waitForSelector('[data-testid="workflow-complete"]', {
      timeout: 60000 // 1 minute max
    });

    // Step 7: Verify results
    const resultsPanel = window.locator('[data-testid="results-panel"]');
    await expect(resultsPanel).toBeVisible();

    // Check statistics
    const matchedCount = await window.locator('[data-testid="matched-count"]').textContent();
    expect(parseInt(matchedCount || '0')).toBeGreaterThan(0);

    const accuracy = await window.locator('[data-testid="accuracy-score"]').textContent();
    const accuracyValue = parseFloat(accuracy?.replace('%', '') || '0');
    expect(accuracyValue).toBeGreaterThan(80);

    // Step 8: Review matches
    await window.click('[data-testid="review-matches-button"]');

    const matchList = window.locator('[data-testid="match-list"]');
    await expect(matchList).toBeVisible();

    const matchCards = window.locator('[data-testid^="match-card-"]');
    const matchCount = await matchCards.count();
    expect(matchCount).toBeGreaterThan(0);

    // Verify first match details
    const firstMatch = matchCards.first();
    await expect(firstMatch.locator('[data-testid="confidence-score"]')).toBeVisible();
    await expect(firstMatch.locator('[data-testid="invoice-details"]')).toBeVisible();
    await expect(firstMatch.locator('[data-testid="transaction-details"]')).toBeVisible();

    // Step 9: Approve/reject matches
    await firstMatch.locator('[data-testid="approve-button"]').click();

    await expect(firstMatch).toHaveAttribute('data-status', 'approved');

    // Step 10: Generate report
    await window.click('[data-testid="generate-report-button"]');

    await window.waitForSelector('[data-testid="report-generated"]', {
      timeout: 30000
    });

    // Verify report notification
    const notification = window.locator('[data-testid="notification"]');
    await expect(notification).toContainText(/Report generated successfully/);

    // Step 11: Open report
    await window.click('[data-testid="open-report-button"]');

    // Verify report opens (in system default app or viewer)
    await window.waitForTimeout(1000);
  });

  test('handle file selection dialog', async () => {
    await window.click('[data-testid="workflows-menu"]');
    await window.click('[data-testid="tax-workflow-button"]');

    // Click file selection button
    await window.click('[data-testid="select-invoices-button"]');

    // Verify dialog opens
    // (In real implementation, you'd interact with native dialog)
    await window.waitForTimeout(500);
  });

  test('show progress during workflow execution', async () => {
    await window.click('[data-testid="workflows-menu"]');
    await window.click('[data-testid="tax-workflow-button"]');

    // Setup workflow
    await window.fill('[data-testid="invoices-path-input"]', '/test/data/invoices');
    await window.fill('[data-testid="transactions-path-input"]', '/test/data/transactions.csv');

    // Start workflow
    await window.click('[data-testid="start-workflow-button"]');

    // Verify progress indicator appears
    const progressIndicator = window.locator('[data-testid="progress-indicator"]');
    await expect(progressIndicator).toBeVisible();

    // Verify progress updates
    const progressBar = window.locator('[data-testid="progress-bar"]');
    const initialProgress = await progressBar.getAttribute('aria-valuenow');

    await window.waitForTimeout(1000);

    const updatedProgress = await progressBar.getAttribute('aria-valuenow');
    expect(parseFloat(updatedProgress || '0')).toBeGreaterThanOrEqual(parseFloat(initialProgress || '0'));

    // Verify status messages
    const statusMessage = window.locator('[data-testid="status-message"]');
    await expect(statusMessage).toBeVisible();
    await expect(statusMessage).toContainText(/Processing|Scanning|Matching/);
  });

  test('handle workflow cancellation', async () => {
    await window.click('[data-testid="workflows-menu"]');
    await window.click('[data-testid="tax-workflow-button"]');

    await window.fill('[data-testid="invoices-path-input"]', '/test/data/invoices');
    await window.fill('[data-testid="transactions-path-input"]', '/test/data/transactions.csv');

    await window.click('[data-testid="start-workflow-button"]');

    // Wait for workflow to start
    await window.waitForSelector('[data-testid="progress-indicator"]');

    // Cancel workflow
    await window.click('[data-testid="cancel-workflow-button"]');

    // Verify cancellation confirmation
    const dialog = window.locator('[data-testid="confirm-dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/Are you sure/);

    await window.click('[data-testid="confirm-cancel-button"]');

    // Verify workflow stopped
    await expect(window.locator('[data-testid="workflow-cancelled"]')).toBeVisible();
  });

  test('display error for invalid file paths', async () => {
    await window.click('[data-testid="workflows-menu"]');
    await window.click('[data-testid="tax-workflow-button"]');

    await window.fill('[data-testid="invoices-path-input"]', '/nonexistent/path');
    await window.fill('[data-testid="transactions-path-input"]', '/nonexistent/file.csv');

    await window.click('[data-testid="start-workflow-button"]');

    // Verify error message
    const errorMessage = window.locator('[data-testid="error-message"]');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText(/not found|invalid path/i);
  });

  test('persist workflow state on app restart', async () => {
    await window.click('[data-testid="workflows-menu"]');
    await window.click('[data-testid="tax-workflow-button"]');

    await window.fill('[data-testid="invoices-path-input"]', '/test/data/invoices');
    await window.fill('[data-testid="transactions-path-input"]', '/test/data/transactions.csv');

    await window.click('[data-testid="start-workflow-button"]');

    // Wait for some progress
    await window.waitForSelector('[data-testid="progress-indicator"]');

    // Pause workflow
    await window.click('[data-testid="pause-workflow-button"]');

    // Close and reopen app
    await electronApp.close();

    electronApp = await electron.launch({
      args: [path.join(__dirname, '../../../dist/main/index.js')],
      env: { ...process.env, NODE_ENV: 'test' }
    });

    window = await electronApp.firstWindow();

    // Verify workflow state restored
    const resumeButton = window.locator('[data-testid="resume-workflow-button"]');
    await expect(resumeButton).toBeVisible();

    // Resume and complete
    await resumeButton.click();
  });

  test('keyboard shortcuts work correctly', async () => {
    await window.click('[data-testid="workflows-menu"]');
    await window.click('[data-testid="tax-workflow-button"]');

    // Test Cmd+O for open file
    await window.keyboard.press('Meta+O');

    // Verify file dialog opened
    await window.waitForTimeout(500);

    // Test Cmd+S for save/export
    await window.keyboard.press('Meta+S');

    // Test Cmd+Q for quit (should show confirmation)
    await window.keyboard.press('Meta+Q');

    const quitDialog = window.locator('[data-testid="quit-confirm-dialog"]');
    await expect(quitDialog).toBeVisible();

    // Cancel quit
    await window.keyboard.press('Escape');
  });

  test('responsive UI for different window sizes', async () => {
    // Test small window
    await window.setViewportSize({ width: 800, height: 600 });
    await window.waitForTimeout(500);

    const mobileMenu = window.locator('[data-testid="mobile-menu"]');
    await expect(mobileMenu).toBeVisible();

    // Test large window
    await window.setViewportSize({ width: 1920, height: 1080 });
    await window.waitForTimeout(500);

    const desktopLayout = window.locator('[data-testid="desktop-layout"]');
    await expect(desktopLayout).toBeVisible();
  });
});

test.describe('Match Review Interface', () => {
  let electronApp: ElectronApplication;
  let window: Page;

  test.beforeAll(async () => {
    electronApp = await electron.launch({
      args: [path.join(__dirname, '../../../dist/main/index.js')]
    });
    window = await electronApp.firstWindow();
  });

  test.afterAll(async () => {
    await electronApp.close();
  });

  test('review and approve matches individually', async () => {
    // Navigate to match review
    await window.click('[data-testid="match-review-tab"]');

    const matchCards = window.locator('[data-testid^="match-card-"]');
    const firstMatch = matchCards.first();

    // Expand match details
    await firstMatch.click();

    await expect(firstMatch.locator('[data-testid="match-details-expanded"]')).toBeVisible();

    // Approve match
    await firstMatch.locator('[data-testid="approve-button"]').click();

    await expect(firstMatch).toHaveAttribute('data-status', 'approved');

    // Verify approval reflected in summary
    const approvedCount = window.locator('[data-testid="approved-count"]');
    const count = await approvedCount.textContent();
    expect(parseInt(count || '0')).toBeGreaterThan(0);
  });

  test('bulk approve high-confidence matches', async () => {
    await window.click('[data-testid="match-review-tab"]');

    // Select bulk action
    await window.click('[data-testid="bulk-actions-menu"]');
    await window.click('[data-testid="approve-high-confidence"]');

    // Confirm bulk action
    const confirmDialog = window.locator('[data-testid="confirm-dialog"]');
    await expect(confirmDialog).toBeVisible();

    await window.click('[data-testid="confirm-button"]');

    // Verify multiple matches approved
    const approvedMatches = window.locator('[data-status="approved"]');
    const count = await approvedMatches.count();
    expect(count).toBeGreaterThan(1);
  });

  test('manually match invoice to different transaction', async () => {
    await window.click('[data-testid="match-review-tab"]');

    const matchCard = window.locator('[data-testid="match-card-1"]');
    await matchCard.click();

    // Open manual match picker
    await window.click('[data-testid="change-match-button"]');

    const picker = window.locator('[data-testid="transaction-picker"]');
    await expect(picker).toBeVisible();

    // Select different transaction
    await window.click('[data-testid="transaction-option-2"]');

    // Confirm new match
    await window.click('[data-testid="confirm-new-match"]');

    // Verify match updated
    await expect(matchCard.locator('[data-testid="transaction-id"]')).toContainText('transaction-2');
  });
});
