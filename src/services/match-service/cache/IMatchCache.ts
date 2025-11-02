/**
 * IMatchCache - Interface for caching match results and embeddings
 *
 * Multi-layer caching for performance optimization
 */

import { MatchResult } from '../MatchService';

/**
 * Match cache interface
 */
export interface IMatchCache {
  /**
   * Get cached embeddings
   */
  getEmbedding(text: string): Promise<Float32Array | null>;

  /**
   * Set cached embedding
   */
  setEmbedding(text: string, embedding: Float32Array): Promise<void>;

  /**
   * Get cached match results
   */
  getCachedMatch(documentId: string): Promise<MatchResult[] | null>;

  /**
   * Set cached match results
   */
  setCachedMatch(documentId: string, results: MatchResult[]): Promise<void>;

  /**
   * Invalidate document cache
   */
  invalidateDocument(documentId: string): Promise<void>;

  /**
   * Clear all cache
   */
  clearAll(): Promise<void>;

  /**
   * Get cache statistics
   */
  getStatistics(): Promise<CacheStatistics>;
}

/**
 * Cache statistics
 */
export interface CacheStatistics {
  embeddingCacheSize: number;
  matchCacheSize: number;
  hitRate: number; // 0-1
  avgAccessTime: number; // milliseconds
  totalMemoryUsage: number; // bytes
}
