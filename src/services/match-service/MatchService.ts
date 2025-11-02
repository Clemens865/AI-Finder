/**
 * MatchService - Intelligent Document Matching Engine
 *
 * Orchestrates multi-algorithm matching pipeline for document similarity detection
 * Combines fuzzy matching, semantic similarity, date proximity, and amount matching
 */

import { Document } from '../../types/Document';
import { IFuzzyMatchEngine } from './engines/IFuzzyMatchEngine';
import { ISemanticMatchEngine } from './engines/ISemanticMatchEngine';
import { IDateMatchEngine } from './engines/IDateMatchEngine';
import { IAmountMatchEngine } from './engines/IAmountMatchEngine';
import { IConfidenceScorer } from './scoring/IConfidenceScorer';
import { IMatchCache } from './cache/IMatchCache';

/**
 * Match result representing similarity between two documents
 */
export interface MatchResult {
  matchId: string;
  sourceDocumentId: string;
  targetDocumentId: string;
  confidence: number; // 0-1, overall confidence

  factors: {
    fuzzy: number;
    semantic: number;
    date: number;
    amount: number;
    metadata: number;
  };

  explanation: string;
  status: 'pending' | 'accepted' | 'rejected';
  timestamp: Date;
}

/**
 * Options for match finding
 */
export interface MatchOptions {
  minConfidence?: number; // Minimum confidence threshold (default: 0.5)
  maxResults?: number; // Maximum number of results (default: 10)
  algorithms?: ('fuzzy' | 'semantic' | 'date' | 'amount')[]; // Algorithms to use
  useCache?: boolean; // Use cached results (default: true)

  filters?: {
    dateRange?: [Date, Date];
    amountRange?: [number, number];
    documentTypes?: string[];
    excludeDocuments?: string[];
  };
}

/**
 * Batch matching options
 */
export interface BatchMatchOptions extends MatchOptions {
  batchSize?: number; // Documents per batch (default: 100)
  concurrency?: number; // Parallel workers (default: 4)
  onProgress?: (progress: BatchProgress) => void;
}

/**
 * Batch processing progress
 */
export interface BatchProgress {
  jobId: string;
  processed: number;
  total: number;
  currentDocument: string;
  estimatedTimeRemaining: number; // milliseconds
}

/**
 * Batch matching result
 */
export interface BatchMatchResult {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  totalMatches: number;
  averageConfidence: number;
  processingTime: number;
  matches: MatchResult[];
}

/**
 * User feedback on a match
 */
export interface UserFeedback {
  matchId: string;
  accepted: boolean;
  reason?: string;
  timeToDecision?: number; // milliseconds
  corrections?: {
    field: string;
    correctValue: any;
  }[];
}

/**
 * Confidence weights configuration
 */
export interface ConfidenceWeights {
  fuzzy: number;
  semantic: number;
  date: number;
  amount: number;
  metadata: number;

  contextMultipliers?: {
    documentType?: Record<string, number>;
    userPreference?: Record<string, number>;
  };
}

/**
 * Match service interface
 */
export interface IMatchService {
  /**
   * Find matches for a document
   */
  findMatches(documentId: string, options?: MatchOptions): Promise<MatchResult[]>;

  /**
   * Process batch of documents
   */
  batchMatch(documentIds: string[], options?: BatchMatchOptions): Promise<BatchMatchResult>;

  /**
   * Validate a match with user feedback
   */
  validateMatch(matchId: string, feedback: UserFeedback): Promise<void>;

  /**
   * Get match by ID
   */
  getMatch(matchId: string): Promise<MatchResult | null>;

  /**
   * Update confidence weights
   */
  updateWeights(weights: ConfidenceWeights): Promise<void>;

  /**
   * Get current weights
   */
  getWeights(documentType?: string): Promise<ConfidenceWeights>;

  /**
   * Get match statistics
   */
  getStatistics(timeRange?: [Date, Date]): Promise<MatchStatistics>;
}

/**
 * Match statistics
 */
export interface MatchStatistics {
  totalMatches: number;
  acceptanceRate: number;
  averageConfidence: number;
  averageProcessingTime: number;

  byAlgorithm: {
    fuzzy: { count: number; avgScore: number; };
    semantic: { count: number; avgScore: number; };
    date: { count: number; avgScore: number; };
    amount: { count: number; avgScore: number; };
  };

  byConfidenceLevel: {
    high: number; // 0.9+
    medium: number; // 0.7-0.9
    low: number; // 0.5-0.7
    veryLow: number; // <0.5
  };
}

/**
 * Internal algorithm match result
 */
interface AlgorithmMatch {
  algorithm: string;
  score: number;
  metadata?: Record<string, any>;
}

/**
 * Match Service Implementation
 *
 * Multi-stage pipeline:
 * 1. Check cache
 * 2. Load document and extract features
 * 3. Parallel algorithm execution
 * 4. Confidence scoring and aggregation
 * 5. Filter and sort results
 * 6. Cache results
 */
export class MatchService implements IMatchService {
  constructor(
    private readonly fuzzyEngine: IFuzzyMatchEngine,
    private readonly semanticEngine: ISemanticMatchEngine,
    private readonly dateEngine: IDateMatchEngine,
    private readonly amountEngine: IAmountMatchEngine,
    private readonly scorer: IConfidenceScorer,
    private readonly cache: IMatchCache
  ) {}

  /**
   * Find matches for a document
   *
   * Performance targets:
   * - Cache hit: <50ms
   * - Cache miss: <500ms (P95)
   * - 10K document corpus
   */
  async findMatches(
    documentId: string,
    options: MatchOptions = {}
  ): Promise<MatchResult[]> {
    const startTime = Date.now();

    // Apply defaults
    const opts: Required<MatchOptions> = {
      minConfidence: options.minConfidence ?? 0.5,
      maxResults: options.maxResults ?? 10,
      algorithms: options.algorithms ?? ['fuzzy', 'semantic', 'date', 'amount'],
      useCache: options.useCache ?? true,
      filters: options.filters ?? {}
    };

    // Check cache
    if (opts.useCache) {
      const cached = await this.cache.getCachedMatch(documentId);
      if (cached) {
        return this.filterResults(cached, opts);
      }
    }

    // Load source document
    const sourceDoc = await this.loadDocument(documentId);
    if (!sourceDoc) {
      throw new Error(`Document not found: ${documentId}`);
    }

    // Load candidate documents (with pre-filtering)
    const candidates = await this.loadCandidates(sourceDoc, opts.filters);

    // Execute matching algorithms in parallel
    const matchPromises = candidates.map(async (candidate) => {
      const algorithmResults: AlgorithmMatch[] = [];

      // Run enabled algorithms in parallel
      const [fuzzy, semantic, date, amount] = await Promise.allSettled([
        opts.algorithms.includes('fuzzy')
          ? this.fuzzyEngine.matchDocuments(sourceDoc, candidate)
          : Promise.resolve(null),

        opts.algorithms.includes('semantic')
          ? this.semanticEngine.matchDocuments(sourceDoc, candidate)
          : Promise.resolve(null),

        opts.algorithms.includes('date')
          ? this.dateEngine.matchDocuments(sourceDoc, candidate)
          : Promise.resolve(null),

        opts.algorithms.includes('amount')
          ? this.amountEngine.matchDocuments(sourceDoc, candidate)
          : Promise.resolve(null)
      ]);

      // Collect results
      if (fuzzy.status === 'fulfilled' && fuzzy.value) {
        algorithmResults.push({ algorithm: 'fuzzy', score: fuzzy.value.score });
      }
      if (semantic.status === 'fulfilled' && semantic.value) {
        algorithmResults.push({ algorithm: 'semantic', score: semantic.value.score });
      }
      if (date.status === 'fulfilled' && date.value) {
        algorithmResults.push({ algorithm: 'date', score: date.value.score });
      }
      if (amount.status === 'fulfilled' && amount.value) {
        algorithmResults.push({ algorithm: 'amount', score: amount.value.score });
      }

      // Calculate confidence
      const confidenceScore = await this.scorer.calculateConfidence(
        algorithmResults,
        sourceDoc.type
      );

      // Build match result
      return this.buildMatchResult(
        sourceDoc.id,
        candidate.id,
        confidenceScore,
        algorithmResults
      );
    });

    // Wait for all matches
    const matches = await Promise.all(matchPromises);

    // Filter and sort
    const filteredMatches = matches
      .filter(m => m.confidence >= opts.minConfidence)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, opts.maxResults);

    // Cache results
    if (opts.useCache) {
      await this.cache.setCachedMatch(documentId, filteredMatches);
    }

    // Log performance
    const duration = Date.now() - startTime;
    console.log(`[MatchService] Found ${filteredMatches.length} matches in ${duration}ms`);

    return filteredMatches;
  }

  /**
   * Batch matching with parallel processing
   */
  async batchMatch(
    documentIds: string[],
    options: BatchMatchOptions = {}
  ): Promise<BatchMatchResult> {
    const jobId = this.generateJobId();
    const startTime = Date.now();

    const opts = {
      ...options,
      batchSize: options.batchSize ?? 100,
      concurrency: options.concurrency ?? 4
    };

    const allMatches: MatchResult[] = [];
    let processed = 0;

    // Process in batches
    for (let i = 0; i < documentIds.length; i += opts.batchSize) {
      const batch = documentIds.slice(i, i + opts.batchSize);

      // Process batch with concurrency limit
      const batchPromises = batch.map(docId =>
        this.findMatches(docId, options)
      );

      const batchResults = await this.limitConcurrency(
        batchPromises,
        opts.concurrency
      );

      // Flatten results
      batchResults.forEach(results => allMatches.push(...results));

      // Update progress
      processed += batch.length;
      if (options.onProgress) {
        options.onProgress({
          jobId,
          processed,
          total: documentIds.length,
          currentDocument: batch[batch.length - 1],
          estimatedTimeRemaining: this.estimateTimeRemaining(
            processed,
            documentIds.length,
            Date.now() - startTime
          )
        });
      }
    }

    const processingTime = Date.now() - startTime;
    const averageConfidence = allMatches.reduce((sum, m) => sum + m.confidence, 0) / allMatches.length;

    return {
      jobId,
      status: 'completed',
      totalMatches: allMatches.length,
      averageConfidence,
      processingTime,
      matches: allMatches
    };
  }

  /**
   * Validate match with user feedback
   * Used for learning and weight adjustment
   */
  async validateMatch(matchId: string, feedback: UserFeedback): Promise<void> {
    // Store feedback
    await this.storeFeedback(feedback);

    // Update match status
    await this.updateMatchStatus(matchId, feedback.accepted ? 'accepted' : 'rejected');

    // Invalidate cache for this document
    const match = await this.getMatch(matchId);
    if (match) {
      await this.cache.invalidateDocument(match.sourceDocumentId);
    }

    // Trigger learning pipeline (async)
    this.scorer.learnFromFeedback(feedback).catch(err => {
      console.error('[MatchService] Learning error:', err);
    });
  }

  /**
   * Get match by ID
   */
  async getMatch(matchId: string): Promise<MatchResult | null> {
    // Implementation: Load from database
    throw new Error('Not implemented');
  }

  /**
   * Update confidence weights
   */
  async updateWeights(weights: ConfidenceWeights): Promise<void> {
    await this.scorer.updateWeights(weights);

    // Clear cache (weights changed)
    await this.cache.clearAll();
  }

  /**
   * Get current weights
   */
  async getWeights(documentType?: string): Promise<ConfidenceWeights> {
    return this.scorer.getWeights(documentType);
  }

  /**
   * Get match statistics
   */
  async getStatistics(timeRange?: [Date, Date]): Promise<MatchStatistics> {
    // Implementation: Query database for statistics
    throw new Error('Not implemented');
  }

  // ========================================
  // Private Helper Methods
  // ========================================

  private async loadDocument(documentId: string): Promise<Document | null> {
    // Implementation: Load from database
    throw new Error('Not implemented');
  }

  private async loadCandidates(
    sourceDoc: Document,
    filters: MatchOptions['filters']
  ): Promise<Document[]> {
    // Implementation: Load candidate documents with pre-filtering
    throw new Error('Not implemented');
  }

  private buildMatchResult(
    sourceId: string,
    targetId: string,
    confidence: { overall: number; factors: any },
    algorithms: AlgorithmMatch[]
  ): MatchResult {
    return {
      matchId: this.generateMatchId(),
      sourceDocumentId: sourceId,
      targetDocumentId: targetId,
      confidence: confidence.overall,
      factors: confidence.factors,
      explanation: this.generateExplanation(confidence, algorithms),
      status: 'pending',
      timestamp: new Date()
    };
  }

  private generateExplanation(
    confidence: { overall: number; factors: any },
    algorithms: AlgorithmMatch[]
  ): string {
    const topFactors = Object.entries(confidence.factors)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, 2)
      .map(([name]) => name);

    return `Match based primarily on ${topFactors.join(' and ')} similarity`;
  }

  private filterResults(
    results: MatchResult[],
    options: Required<MatchOptions>
  ): MatchResult[] {
    return results
      .filter(r => r.confidence >= options.minConfidence)
      .slice(0, options.maxResults);
  }

  private async limitConcurrency<T>(
    promises: Promise<T>[],
    limit: number
  ): Promise<T[]> {
    const results: T[] = [];

    for (let i = 0; i < promises.length; i += limit) {
      const batch = promises.slice(i, i + limit);
      const batchResults = await Promise.all(batch);
      results.push(...batchResults);
    }

    return results;
  }

  private estimateTimeRemaining(
    processed: number,
    total: number,
    elapsedMs: number
  ): number {
    const avgTimePerDoc = elapsedMs / processed;
    const remaining = total - processed;
    return Math.round(avgTimePerDoc * remaining);
  }

  private async storeFeedback(feedback: UserFeedback): Promise<void> {
    // Implementation: Store in database
    throw new Error('Not implemented');
  }

  private async updateMatchStatus(
    matchId: string,
    status: 'accepted' | 'rejected'
  ): Promise<void> {
    // Implementation: Update database
    throw new Error('Not implemented');
  }

  private generateJobId(): string {
    return `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateMatchId(): string {
    return `match-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
