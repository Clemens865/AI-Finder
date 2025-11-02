/**
 * IDateMatchEngine - Interface for date matching and proximity detection
 *
 * Provides date parsing, normalization, and fuzzy date matching
 */

import { Document } from '../../../types/Document';

/**
 * Date extraction result
 */
export interface DateExtraction {
  date: Date;
  confidence: number; // 0-1
  source: 'ocr' | 'metadata' | 'inferred';
  format: string;
  context: 'invoice_date' | 'due_date' | 'payment_date' | 'contract_date' | 'unknown';
  rawText: string;
}

/**
 * Date match result
 */
export interface DateMatchResult {
  match: boolean;
  score: number; // 0-1
  daysDifference: number;
  explanation: string;
}

/**
 * Date range
 */
export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Recurring pattern
 */
export interface RecurringPattern {
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  interval: number;
  confidence: number;
}

/**
 * Date match engine interface
 */
export interface IDateMatchEngine {
  /**
   * Extract dates from text
   */
  extractDates(text: string): DateExtraction[];

  /**
   * Parse date field with multiple format support
   */
  parseDateField(field: string): Date | null;

  /**
   * Match two dates with fuzzy window
   */
  matchDates(date1: Date, date2: Date, windowDays?: number): DateMatchResult;

  /**
   * Detect recurring patterns in dates
   */
  detectRecurringPattern(dates: Date[]): RecurringPattern | null;

  /**
   * Normalize date range
   */
  normalizeDateRange(start: Date, end: Date): DateRange;

  /**
   * Match two documents based on dates
   */
  matchDocuments(doc1: Document, doc2: Document): Promise<{ score: number }>;
}
