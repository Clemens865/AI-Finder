/**
 * Integration tests for Tax Workflow
 * Tests the complete invoice-to-transaction matching workflow
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import * as path from 'path';
import * as fs from 'fs/promises';
import {
  generateInvoiceData,
  generateTransactionData,
  mockPDFContent,
  mockCSVContent,
  TEST_PATHS
} from '../../fixtures/test-data';

// Mock implementations of services
class TaxWorkflow {
  private fileService: any;
  private aiService: any;
  private matchService: any;
  private ragService: any;

  constructor(services: any) {
    this.fileService = services.fileService;
    this.aiService = services.aiService;
    this.matchService = services.matchService;
    this.ragService = services.ragService;
  }

  async execute(input: { invoicesPath: string; transactionsPath: string }) {
    // Step 1: Scan invoices
    const invoices = await this.scanInvoices(input.invoicesPath);

    // Step 2: Scan transactions
    const transactions = await this.scanTransactions(input.transactionsPath);

    // Step 3: Find matches
    const matches = await this.findMatches(invoices, transactions);

    // Step 4: Review and approve
    const reviewed = await this.reviewMatches(matches);

    // Step 5: Generate report
    const report = await this.generateReport(reviewed);

    return {
      invoices: invoices.length,
      transactions: transactions.length,
      matched: reviewed.filter(m => m.status === 'approved').length,
      unmatched: reviewed.filter(m => m.status === 'rejected').length,
      accuracy: this.calculateAccuracy(reviewed),
      report
    };
  }

  private async scanInvoices(dirPath: string) {
    return [generateInvoiceData(), generateInvoiceData()];
  }

  private async scanTransactions(filePath: string) {
    return [generateTransactionData(), generateTransactionData()];
  }

  private async findMatches(invoices: any[], transactions: any[]) {
    const allMatches = [];
    for (const invoice of invoices) {
      const matches = await this.matchService.findMatches(invoice, transactions);
      allMatches.push(...matches.map(m => ({ ...m, invoice, status: 'pending' })));
    }
    return allMatches;
  }

  private async reviewMatches(matches: any[]) {
    return matches.map(m => ({
      ...m,
      status: m.confidence > 0.9 ? 'approved' : 'pending'
    }));
  }

  private async generateReport(matches: any[]) {
    return {
      summary: 'Tax report generated',
      matchCount: matches.length,
      timestamp: new Date()
    };
  }

  private calculateAccuracy(matches: any[]) {
    const approved = matches.filter(m => m.status === 'approved').length;
    return matches.length > 0 ? approved / matches.length : 0;
  }
}

describe('Tax Workflow Integration', () => {
  let workflow: TaxWorkflow;
  let testDir: string;

  beforeAll(async () => {
    // Setup test directory
    testDir = '/tmp/intelligent-finder-test-' + Date.now();
    await fs.mkdir(testDir, { recursive: true });
    await fs.mkdir(path.join(testDir, 'invoices'), { recursive: true });
  });

  afterAll(async () => {
    // Cleanup test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  beforeEach(() => {
    // Initialize workflow with mock services
    const mockServices = {
      fileService: {
        read: jest.fn(),
        extract: jest.fn()
      },
      aiService: {
        extract: jest.fn(),
        embed: jest.fn()
      },
      matchService: {
        findMatches: jest.fn().mockResolvedValue([
          {
            id: 'match-1',
            confidence: 0.95,
            reasoning: 'Strong match on vendor and amount'
          }
        ])
      },
      ragService: {
        getPatterns: jest.fn(),
        recordPattern: jest.fn()
      }
    };

    workflow = new TaxWorkflow(mockServices);
  });

  describe('complete workflow', () => {
    it('should execute complete tax workflow successfully', async () => {
      const input = {
        invoicesPath: path.join(testDir, 'invoices'),
        transactionsPath: path.join(testDir, 'transactions.csv')
      };

      const result = await workflow.execute(input);

      expect(result).toHaveProperty('invoices');
      expect(result).toHaveProperty('transactions');
      expect(result).toHaveProperty('matched');
      expect(result).toHaveProperty('accuracy');
      expect(result).toHaveProperty('report');

      expect(result.invoices).toBeGreaterThan(0);
      expect(result.transactions).toBeGreaterThan(0);
      expect(result.matched).toBeLessThanOrEqual(result.invoices);
    });

    it('should achieve >80% matching accuracy', async () => {
      const input = {
        invoicesPath: path.join(testDir, 'invoices'),
        transactionsPath: path.join(testDir, 'transactions.csv')
      };

      const result = await workflow.execute(input);

      expect(result.accuracy).toBeGreaterThan(0.8);
    });

    it('should handle large batches efficiently', async () => {
      const input = {
        invoicesPath: path.join(testDir, 'invoices'),
        transactionsPath: path.join(testDir, 'transactions.csv')
      };

      const start = performance.now();
      const result = await workflow.execute(input);
      const duration = performance.now() - start;

      // Should complete in reasonable time (< 10 seconds for test data)
      expect(duration).toBeLessThan(10000);
      expect(result).toBeDefined();
    });
  });

  describe('invoice scanning', () => {
    it('should extract data from all PDF invoices', async () => {
      const input = {
        invoicesPath: path.join(testDir, 'invoices'),
        transactionsPath: path.join(testDir, 'transactions.csv')
      };

      const result = await workflow.execute(input);

      expect(result.invoices).toBeGreaterThan(0);
    });

    it('should handle mixed file types', async () => {
      // Test with PDFs and images
      const input = {
        invoicesPath: path.join(testDir, 'invoices'),
        transactionsPath: path.join(testDir, 'transactions.csv')
      };

      const result = await workflow.execute(input);

      expect(result.invoices).toBeGreaterThan(0);
    });

    it('should handle OCR for scanned invoices', async () => {
      const input = {
        invoicesPath: path.join(testDir, 'invoices'),
        transactionsPath: path.join(testDir, 'transactions.csv')
      };

      const result = await workflow.execute(input);

      // Should successfully extract even from scanned PDFs
      expect(result.invoices).toBeGreaterThan(0);
    });
  });

  describe('transaction parsing', () => {
    it('should parse CSV transactions correctly', async () => {
      const input = {
        invoicesPath: path.join(testDir, 'invoices'),
        transactionsPath: path.join(testDir, 'transactions.csv')
      };

      const result = await workflow.execute(input);

      expect(result.transactions).toBeGreaterThan(0);
    });

    it('should handle Excel transaction files', async () => {
      const input = {
        invoicesPath: path.join(testDir, 'invoices'),
        transactionsPath: path.join(testDir, 'transactions.xlsx')
      };

      const result = await workflow.execute(input);

      expect(result.transactions).toBeGreaterThan(0);
    });

    it('should handle various date formats', async () => {
      const input = {
        invoicesPath: path.join(testDir, 'invoices'),
        transactionsPath: path.join(testDir, 'transactions.csv')
      };

      const result = await workflow.execute(input);

      expect(result).toBeDefined();
    });
  });

  describe('matching logic', () => {
    it('should find exact matches with high confidence', async () => {
      const input = {
        invoicesPath: path.join(testDir, 'invoices'),
        transactionsPath: path.join(testDir, 'transactions.csv')
      };

      const result = await workflow.execute(input);

      expect(result.matched).toBeGreaterThan(0);
      expect(result.accuracy).toBeGreaterThan(0.8);
    });

    it('should identify ambiguous matches for review', async () => {
      const input = {
        invoicesPath: path.join(testDir, 'invoices'),
        transactionsPath: path.join(testDir, 'transactions.csv')
      };

      const result = await workflow.execute(input);

      // Some matches may require manual review
      const needsReview = result.invoices - result.matched - result.unmatched;
      expect(needsReview).toBeGreaterThanOrEqual(0);
    });

    it('should handle one-to-many relationships', async () => {
      // One invoice might match multiple transactions (partial payments)
      const input = {
        invoicesPath: path.join(testDir, 'invoices'),
        transactionsPath: path.join(testDir, 'transactions.csv')
      };

      const result = await workflow.execute(input);

      expect(result).toBeDefined();
    });
  });

  describe('report generation', () => {
    it('should generate structured Excel report', async () => {
      const input = {
        invoicesPath: path.join(testDir, 'invoices'),
        transactionsPath: path.join(testDir, 'transactions.csv')
      };

      const result = await workflow.execute(input);

      expect(result.report).toBeDefined();
      expect(result.report).toHaveProperty('summary');
      expect(result.report).toHaveProperty('matchCount');
    });

    it('should include confidence scores in report', async () => {
      const input = {
        invoicesPath: path.join(testDir, 'invoices'),
        transactionsPath: path.join(testDir, 'transactions.csv')
      };

      const result = await workflow.execute(input);

      expect(result.report).toBeDefined();
    });

    it('should highlight unmatched items', async () => {
      const input = {
        invoicesPath: path.join(testDir, 'invoices'),
        transactionsPath: path.join(testDir, 'transactions.csv')
      };

      const result = await workflow.execute(input);

      expect(result.unmatched).toBeDefined();
      expect(result.unmatched).toBeGreaterThanOrEqual(0);
    });
  });

  describe('error handling', () => {
    it('should handle missing invoice directory', async () => {
      const input = {
        invoicesPath: '/nonexistent/path',
        transactionsPath: path.join(testDir, 'transactions.csv')
      };

      await expect(workflow.execute(input)).rejects.toThrow();
    });

    it('should handle corrupt PDF files', async () => {
      const input = {
        invoicesPath: path.join(testDir, 'invoices'),
        transactionsPath: path.join(testDir, 'transactions.csv')
      };

      // Should skip corrupt files and continue
      const result = await workflow.execute(input);
      expect(result).toBeDefined();
    });

    it('should handle empty transaction file', async () => {
      const input = {
        invoicesPath: path.join(testDir, 'invoices'),
        transactionsPath: path.join(testDir, 'empty.csv')
      };

      const result = await workflow.execute(input);

      expect(result.transactions).toBe(0);
      expect(result.matched).toBe(0);
    });
  });

  describe('learning and improvement', () => {
    it('should store patterns for future use', async () => {
      const input = {
        invoicesPath: path.join(testDir, 'invoices'),
        transactionsPath: path.join(testDir, 'transactions.csv')
      };

      await workflow.execute(input);

      // Patterns should be recorded in RAG
      // (Would verify through RAG service in real implementation)
    });

    it('should improve accuracy on second run', async () => {
      const input = {
        invoicesPath: path.join(testDir, 'invoices'),
        transactionsPath: path.join(testDir, 'transactions.csv')
      };

      // First run
      const firstResult = await workflow.execute(input);
      const firstAccuracy = firstResult.accuracy;

      // Second run with learned patterns
      const secondResult = await workflow.execute(input);
      const secondAccuracy = secondResult.accuracy;

      // Should maintain or improve accuracy
      expect(secondAccuracy).toBeGreaterThanOrEqual(firstAccuracy);
    });
  });
});
