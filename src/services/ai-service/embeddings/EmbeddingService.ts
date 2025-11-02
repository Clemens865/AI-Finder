/**
 * Embedding Service
 *
 * Generate semantic embeddings for text using local models.
 * Supports batching, caching, and multiple embedding models.
 */

import {
  EmbeddingRequest,
  EmbeddingResponse,
  EmbeddingModel,
  CacheEntry,
  AIServiceError,
  AIErrorType
} from '../types';

/**
 * Embedding cache for performance
 */
class EmbeddingCache {
  private cache: Map<string, CacheEntry<number[]>>;
  private maxSize: number;
  private ttl: number;

  constructor(maxSize: number = 1000, ttl: number = 3600000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  get(key: string): number[] | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    entry.hits++;
    return entry.value;
  }

  set(key: string, value: number[]): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      key,
      value,
      timestamp: Date.now(),
      ttl: this.ttl,
      hits: 0
    });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

/**
 * EmbeddingService - Generate semantic embeddings
 */
export class EmbeddingService {
  private model: EmbeddingModel;
  private cache: EmbeddingCache;
  private batchSize: number;
  private cacheEnabled: boolean;

  constructor(
    model: EmbeddingModel = EmbeddingModel.SENTENCE_TRANSFORMERS,
    batchSize: number = 32,
    cacheEnabled: boolean = true
  ) {
    this.model = model;
    this.batchSize = batchSize;
    this.cacheEnabled = cacheEnabled;
    this.cache = new EmbeddingCache();
  }

  /**
   * Generate embeddings for text
   */
  async generateEmbeddings(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const startTime = Date.now();
    const texts = Array.isArray(request.text) ? request.text : [request.text];
    const model = request.model || this.model;

    try {
      const embeddings: number[][] = [];

      // Process in batches
      for (let i = 0; i < texts.length; i += this.batchSize) {
        const batch = texts.slice(i, i + this.batchSize);
        const batchEmbeddings = await this.processBatch(batch, model);
        embeddings.push(...batchEmbeddings);
      }

      // Normalize if requested
      const finalEmbeddings = request.normalize
        ? embeddings.map(e => this.normalize(e))
        : embeddings;

      const latencyMs = Date.now() - startTime;

      return {
        embeddings: finalEmbeddings,
        model: model,
        dimensions: finalEmbeddings[0]?.length || 0,
        latencyMs
      };

    } catch (error) {
      throw new AIServiceError(
        `Embedding generation failed: ${(error as Error).message}`,
        AIErrorType.UNKNOWN,
        undefined,
        true,
        error as Error
      );
    }
  }

  /**
   * Process a batch of texts
   */
  private async processBatch(texts: string[], model: string): Promise<number[][]> {
    const embeddings: number[][] = [];

    for (const text of texts) {
      // Check cache first
      if (this.cacheEnabled) {
        const cacheKey = this.getCacheKey(text, model);
        const cached = this.cache.get(cacheKey);
        if (cached) {
          embeddings.push(cached);
          continue;
        }
      }

      // Generate embedding
      const embedding = await this.generateSingleEmbedding(text, model);
      embeddings.push(embedding);

      // Cache result
      if (this.cacheEnabled) {
        const cacheKey = this.getCacheKey(text, model);
        this.cache.set(cacheKey, embedding);
      }
    }

    return embeddings;
  }

  /**
   * Generate embedding for single text
   *
   * Note: This is a placeholder implementation. In production, this would:
   * 1. Use a local sentence-transformers model via ONNX Runtime
   * 2. Or call Ollama with embedding models
   * 3. Or use a dedicated embedding service
   */
  private async generateSingleEmbedding(text: string, model: string): Promise<number[]> {
    // For now, return a mock embedding
    // TODO: Implement actual embedding generation

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 10));

    // Return mock 384-dimensional embedding (typical for MiniLM)
    const dimensions = this.getModelDimensions(model);
    return Array.from({ length: dimensions }, () => Math.random() * 2 - 1);
  }

  /**
   * Get model dimensions
   */
  private getModelDimensions(model: string): number {
    switch (model) {
      case EmbeddingModel.SENTENCE_TRANSFORMERS:
        return 384;
      case EmbeddingModel.MULTILINGUAL:
        return 384;
      case EmbeddingModel.SEMANTIC_SEARCH:
        return 384;
      default:
        return 384;
    }
  }

  /**
   * Normalize vector to unit length
   */
  private normalize(vector: number[]): number[] {
    const magnitude = Math.sqrt(
      vector.reduce((sum, val) => sum + val * val, 0)
    );

    if (magnitude === 0) return vector;

    return vector.map(val => val / magnitude);
  }

  /**
   * Compute cosine similarity between two vectors
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same dimensions');
    }

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      magnitudeA += a[i] * a[i];
      magnitudeB += b[i] * b[i];
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) return 0;

    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Get cache key for text and model
   */
  private getCacheKey(text: string, model: string): string {
    // Simple hash function for cache key
    const hash = this.simpleHash(text + model);
    return `emb-${hash}`;
  }

  /**
   * Simple hash function
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Clear embedding cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number } {
    return {
      size: this.cache.size()
    };
  }

  /**
   * Batch encode texts for efficiency
   */
  async batchEncode(texts: string[], normalize: boolean = true): Promise<number[][]> {
    const response = await this.generateEmbeddings({
      text: texts,
      normalize,
      model: this.model
    });

    return response.embeddings;
  }

  /**
   * Find most similar texts
   */
  async findSimilar(
    query: string,
    candidates: string[],
    topK: number = 5
  ): Promise<Array<{ text: string; similarity: number; index: number }>> {
    // Generate embeddings
    const queryEmbedding = (await this.generateEmbeddings({
      text: query,
      normalize: true
    })).embeddings[0];

    const candidateEmbeddings = (await this.generateEmbeddings({
      text: candidates,
      normalize: true
    })).embeddings;

    // Compute similarities
    const similarities = candidateEmbeddings.map((embedding, index) => ({
      text: candidates[index],
      similarity: this.cosineSimilarity(queryEmbedding, embedding),
      index
    }));

    // Sort by similarity and return top K
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }
}
