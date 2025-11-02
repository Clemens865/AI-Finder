/**
 * ISemanticMatchEngine - Interface for semantic similarity using embeddings
 *
 * Provides vector-based semantic matching for documents
 */

import { Document } from '../../../types/Document';

/**
 * Semantic match result
 */
export interface SemanticMatch {
  documentId: string;
  score: number; // Cosine similarity (0-1)
  embedding?: Float32Array;
}

/**
 * Semantic match engine interface
 */
export interface ISemanticMatchEngine {
  /**
   * Generate embedding for text
   */
  generateEmbedding(text: string): Promise<Float32Array>;

  /**
   * Generate embeddings in batch
   */
  batchEmbeddings(texts: string[]): Promise<Float32Array[]>;

  /**
   * Calculate cosine similarity between vectors
   */
  cosineSimilarity(v1: Float32Array, v2: Float32Array): number;

  /**
   * Find semantically similar documents
   */
  findSemanticMatches(
    queryEmbedding: Float32Array,
    threshold?: number,
    limit?: number
  ): Promise<SemanticMatch[]>;

  /**
   * Match two documents using semantic similarity
   */
  matchDocuments(doc1: Document, doc2: Document): Promise<{ score: number }>;
}
