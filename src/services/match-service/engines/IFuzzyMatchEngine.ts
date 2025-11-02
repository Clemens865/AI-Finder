/**
 * IFuzzyMatchEngine - Interface for fuzzy string matching algorithms
 *
 * Provides string similarity algorithms for document matching
 */

import { Document } from '../../../types/Document';

/**
 * Fuzzy match result
 */
export interface FuzzyMatchResult {
  match: boolean;
  score: number; // 0-1
  algorithm: string;
  confidence: 'low' | 'medium' | 'high';
  details?: {
    levenshteinDistance?: number;
    jaroWinklerScore?: number;
    ngramSimilarity?: number;
  };
}

/**
 * Fuzzy match engine interface
 */
export interface IFuzzyMatchEngine {
  /**
   * Calculate Levenshtein distance between two strings
   * @returns normalized distance (0-1, lower is more similar)
   */
  levenshteinDistance(s1: string, s2: string): number;

  /**
   * Calculate Jaro-Winkler similarity
   * @returns similarity score (0-1, higher is more similar)
   */
  jaroWinklerSimilarity(s1: string, s2: string): number;

  /**
   * Calculate N-gram similarity
   * @param n - N-gram size (default: 2)
   * @returns similarity score (0-1, higher is more similar)
   */
  ngramSimilarity(s1: string, s2: string, n?: number): number;

  /**
   * Composite fuzzy matching using multiple algorithms
   */
  fuzzyMatch(field1: string, field2: string): FuzzyMatchResult;

  /**
   * Match two documents using fuzzy algorithms
   */
  matchDocuments(doc1: Document, doc2: Document): Promise<FuzzyMatchResult>;

  /**
   * Find fuzzy matches in a corpus
   */
  findFuzzyMatches(query: string, corpus: string[], threshold?: number): FuzzyMatchResult[];
}
