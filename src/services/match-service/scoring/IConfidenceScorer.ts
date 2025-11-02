/**
 * IConfidenceScorer - Interface for aggregating match scores into confidence
 *
 * Combines multiple algorithm scores with adaptive weights
 */

/**
 * Confidence score with breakdown
 */
export interface ConfidenceScore {
  overall: number; // 0-1
  tier: 'very_low' | 'low' | 'medium' | 'high';

  factors: {
    fuzzy: number;
    semantic: number;
    date: number;
    amount: number;
    metadata: number;
  };

  weights: {
    fuzzy: number;
    semantic: number;
    date: number;
    amount: number;
    metadata: number;
  };

  explanation: string;
}

/**
 * Confidence weights (adjustable)
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
 * Algorithm match result
 */
export interface AlgorithmMatch {
  algorithm: string;
  score: number;
  metadata?: Record<string, any>;
}

/**
 * User feedback for learning
 */
export interface UserFeedback {
  matchId: string;
  accepted: boolean;
  reason?: string;
  timeToDecision?: number;
  corrections?: { field: string; correctValue: any }[];
}

/**
 * Confidence scorer interface
 */
export interface IConfidenceScorer {
  /**
   * Calculate overall confidence from algorithm scores
   */
  calculateConfidence(
    matches: AlgorithmMatch[],
    documentType?: string
  ): Promise<ConfidenceScore>;

  /**
   * Get current weights
   */
  getWeights(documentType?: string): Promise<ConfidenceWeights>;

  /**
   * Update weights manually
   */
  updateWeights(weights: ConfidenceWeights): Promise<void>;

  /**
   * Learn from user feedback
   */
  learnFromFeedback(feedback: UserFeedback): Promise<void>;

  /**
   * Calculate experimental score for A/B testing
   */
  experimentalScore(
    matches: AlgorithmMatch[],
    experimentId: string
  ): Promise<ConfidenceScore>;
}
