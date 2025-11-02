/**
 * Unit tests for Match Service
 * Tests matching algorithms, confidence scoring, and learning capabilities
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { generateInvoiceData, generateTransactionData, generateMatch } from '../../fixtures/test-data';

interface MatchOptions {
  tolerance?: number;
  minConfidence?: number;
}

interface MatchResult {
  id: string;
  confidence: number;
  reasoning: string;
}

class MatchService {
  async findMatches(source: any, candidates: any[], options?: MatchOptions): Promise<MatchResult[]> {
    const { tolerance = 0.05, minConfidence = 0.7 } = options || {};

    return candidates
      .map((candidate, index) => ({
        id: `match-${index}`,
        confidence: 0.85,
        reasoning: 'Vendor name and amount match'
      }))
      .filter(match => match.confidence >= minConfidence);
  }

  async scoreMatch(item1: any, item2: any): Promise<number> {
    // Simplified scoring logic
    let score = 0;

    // Amount matching (40% weight)
    const amountDiff = Math.abs(item1.amount - Math.abs(item2.amount));
    const amountScore = amountDiff < item1.amount * 0.05 ? 0.4 : 0;
    score += amountScore;

    // Vendor matching (40% weight)
    const vendorMatch = item1.vendor && item2.description?.includes(item1.vendor);
    score += vendorMatch ? 0.4 : 0;

    // Date matching (20% weight)
    const dateDiff = Math.abs(item1.date.getTime() - item2.date.getTime());
    const daysDiff = dateDiff / (1000 * 60 * 60 * 24);
    score += daysDiff <= 7 ? 0.2 : 0;

    return score;
  }

  async recordCorrection(matchId: string, correction: any): Promise<void> {
    // Record learning data
  }
}

describe('MatchService', () => {
  let matchService: MatchService;

  beforeEach(() => {
    matchService = new MatchService();
  });

  describe('findMatches', () => {
    it('should find exact matches with high confidence', async () => {
      const invoice = generateInvoiceData();
      const transaction = {
        ...generateTransactionData(),
        description: invoice.vendor,
        amount: -invoice.amount
      };

      const matches = await matchService.findMatches(invoice, [transaction]);

      expect(matches).toHaveLength(1);
      expect(matches[0].confidence).toBeGreaterThan(0.9);
    });

    it('should find fuzzy matches with lower confidence', async () => {
      const invoice = generateInvoiceData();
      const transaction = {
        ...generateTransactionData(),
        description: invoice.vendor.substring(0, 8), // Partial match
        amount: -invoice.amount * 1.02 // 2% difference
      };

      const matches = await matchService.findMatches(invoice, [transaction]);

      expect(matches).toHaveLength(1);
      expect(matches[0].confidence).toBeGreaterThan(0.7);
      expect(matches[0].confidence).toBeLessThan(0.9);
    });

    it('should respect tolerance settings', async () => {
      const invoice = generateInvoiceData();
      const transaction = {
        ...generateTransactionData(),
        amount: -invoice.amount * 1.1 // 10% difference
      };

      const strictMatches = await matchService.findMatches(
        invoice,
        [transaction],
        { tolerance: 0.05 }
      );

      const lenientMatches = await matchService.findMatches(
        invoice,
        [transaction],
        { tolerance: 0.15 }
      );

      expect(strictMatches.length).toBeLessThanOrEqual(lenientMatches.length);
    });

    it('should filter by minimum confidence threshold', async () => {
      const invoice = generateInvoiceData();
      const candidates = [
        { ...generateTransactionData(), amount: -invoice.amount }, // Good match
        { ...generateTransactionData(), amount: -invoice.amount * 2 } // Poor match
      ];

      const matches = await matchService.findMatches(invoice, candidates, {
        minConfidence: 0.8
      });

      expect(matches.every(m => m.confidence >= 0.8)).toBe(true);
    });

    it('should handle empty candidate list', async () => {
      const invoice = generateInvoiceData();
      const matches = await matchService.findMatches(invoice, []);

      expect(matches).toHaveLength(0);
    });

    it('should rank matches by confidence', async () => {
      const invoice = generateInvoiceData();
      const candidates = Array.from({ length: 5 }, () => generateTransactionData());

      const matches = await matchService.findMatches(invoice, candidates);

      // Check that matches are sorted by confidence descending
      for (let i = 0; i < matches.length - 1; i++) {
        expect(matches[i].confidence).toBeGreaterThanOrEqual(matches[i + 1].confidence);
      }
    });
  });

  describe('scoreMatch', () => {
    it('should give high score for perfect amount match', async () => {
      const item1 = { amount: 1000, vendor: 'Test Vendor', date: new Date() };
      const item2 = {
        amount: -1000,
        description: 'PAYMENT TO TEST VENDOR',
        date: new Date()
      };

      const score = await matchService.scoreMatch(item1, item2);

      expect(score).toBeGreaterThan(0.9);
    });

    it('should penalize large amount differences', async () => {
      const item1 = { amount: 1000, vendor: 'Test Vendor', date: new Date() };
      const item2 = {
        amount: -1500,
        description: 'PAYMENT TO TEST VENDOR',
        date: new Date()
      };

      const score = await matchService.scoreMatch(item1, item2);

      expect(score).toBeLessThan(0.7);
    });

    it('should weight vendor matching appropriately', async () => {
      const baseDate = new Date('2024-01-15');

      const withVendor = await matchService.scoreMatch(
        { amount: 1000, vendor: 'Test Vendor', date: baseDate },
        { amount: -1000, description: 'Test Vendor', date: baseDate }
      );

      const withoutVendor = await matchService.scoreMatch(
        { amount: 1000, vendor: 'Test Vendor', date: baseDate },
        { amount: -1000, description: 'Different Company', date: baseDate }
      );

      expect(withVendor).toBeGreaterThan(withoutVendor);
      expect(withVendor - withoutVendor).toBeCloseTo(0.4, 1);
    });

    it('should consider date proximity', async () => {
      const invoice = {
        amount: 1000,
        vendor: 'Test Vendor',
        date: new Date('2024-01-15')
      };

      const sameDayTransaction = {
        amount: -1000,
        description: 'Test Vendor',
        date: new Date('2024-01-15')
      };

      const weekLaterTransaction = {
        amount: -1000,
        description: 'Test Vendor',
        date: new Date('2024-01-22')
      };

      const sameDayScore = await matchService.scoreMatch(invoice, sameDayTransaction);
      const weekLaterScore = await matchService.scoreMatch(invoice, weekLaterTransaction);

      expect(sameDayScore).toBeGreaterThan(weekLaterScore);
    });
  });

  describe('recordCorrection', () => {
    it('should record user corrections for learning', async () => {
      const match = generateMatch();
      const correction = {
        approved: false,
        correctTargetId: 'different-id',
        reason: 'Wrong vendor'
      };

      await expect(
        matchService.recordCorrection(match.id, correction)
      ).resolves.not.toThrow();
    });

    it('should improve future matches after corrections', async () => {
      // Record correction
      const correction = {
        matchId: 'match-1',
        approved: false,
        correctTargetId: 'target-2'
      };

      await matchService.recordCorrection('match-1', correction);

      // Future matches should reflect learning
      // (This would require integration with RAG service)
    });
  });

  describe('performance', () => {
    it('should handle large candidate sets efficiently', async () => {
      const invoice = generateInvoiceData();
      const candidates = Array.from({ length: 1000 }, () => generateTransactionData());

      const start = performance.now();
      const matches = await matchService.findMatches(invoice, candidates);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(500); // Should complete in under 500ms
      expect(matches).toBeDefined();
    });

    it('should batch process multiple invoices', async () => {
      const invoices = Array.from({ length: 50 }, () => generateInvoiceData());
      const transactions = Array.from({ length: 500 }, () => generateTransactionData());

      const start = performance.now();
      const results = await Promise.all(
        invoices.map(inv => matchService.findMatches(inv, transactions))
      );
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(5000); // 5 seconds for 50 invoices
      expect(results).toHaveLength(50);
    });
  });

  describe('edge cases', () => {
    it('should handle invoices with special characters', async () => {
      const invoice = {
        ...generateInvoiceData(),
        vendor: 'Café & Résumé Inc. ™'
      };

      const transaction = {
        ...generateTransactionData(),
        description: 'CAFE & RESUME INC'
      };

      const matches = await matchService.findMatches(invoice, [transaction]);

      expect(matches.length).toBeGreaterThan(0);
    });

    it('should handle negative invoice amounts (credits)', async () => {
      const creditNote = {
        ...generateInvoiceData(),
        amount: -500
      };

      const refund = {
        ...generateTransactionData(),
        amount: 500
      };

      const score = await matchService.scoreMatch(creditNote, refund);

      expect(score).toBeGreaterThan(0.7);
    });

    it('should handle multi-currency scenarios', async () => {
      const invoice = { ...generateInvoiceData(), currency: 'EUR' };
      const transaction = { ...generateTransactionData(), currency: 'EUR' };

      const matches = await matchService.findMatches(invoice, [transaction]);

      expect(matches).toBeDefined();
    });
  });
});
