/**
 * IAmountMatchEngine - Interface for amount matching with tolerance
 *
 * Provides currency parsing, amount extraction, and fuzzy amount matching
 */

import { Document } from '../../../types/Document';

/**
 * Amount representation
 */
export interface Amount {
  value: number;
  currency: string;
  precision: number; // Decimal places
}

/**
 * Amount extraction result
 */
export interface AmountExtraction {
  value: number;
  currency: string;
  confidence: number; // 0-1
  type: 'total' | 'subtotal' | 'tax' | 'payment' | 'balance' | 'unknown';
  location?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  rawText: string;
}

/**
 * Amount match result
 */
export interface AmountMatchResult {
  match: boolean;
  score: number; // 0-1
  difference: number; // Absolute difference
  percentDifference: number; // Percentage difference
  explanation: string;
}

/**
 * Fuzzy amount tolerance
 */
export interface FuzzyAmountTolerance {
  absoluteTolerance: number; // ±$X
  percentageTolerance: number; // ±Y%
  roundingTolerance: boolean; // Match $100.00 to $100
  currencyConversion: boolean; // Cross-currency matching
}

/**
 * Invoice amounts hierarchy
 */
export interface InvoiceAmounts {
  lineItems: Amount[];
  subtotal?: Amount;
  tax?: Amount;
  total: Amount;
  payments?: Amount[];
  balance?: Amount;
}

/**
 * Hierarchical match result
 */
export interface HierarchicalMatch {
  lineItemsMatch: boolean;
  subtotalMatch: boolean;
  taxMatch: boolean;
  totalMatch: boolean;
  overallScore: number; // 0-1
}

/**
 * Amount match engine interface
 */
export interface IAmountMatchEngine {
  /**
   * Extract amounts from text
   */
  extractAmounts(text: string): AmountExtraction[];

  /**
   * Parse amount field
   */
  parseAmount(field: string): Amount | null;

  /**
   * Match two amounts with tolerance
   */
  matchAmounts(
    amount1: Amount,
    amount2: Amount,
    tolerance?: FuzzyAmountTolerance
  ): AmountMatchResult;

  /**
   * Match invoice amounts hierarchically
   */
  matchHierarchical(invoice1: InvoiceAmounts, invoice2: InvoiceAmounts): HierarchicalMatch;

  /**
   * Convert currency
   */
  convertCurrency(amount: Amount, toCurrency: string): Promise<Amount>;

  /**
   * Match two documents based on amounts
   */
  matchDocuments(doc1: Document, doc2: Document): Promise<{ score: number }>;
}
