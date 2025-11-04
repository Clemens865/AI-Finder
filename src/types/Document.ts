/**
 * Document Type Definitions
 * Shared across services for file and document handling
 */

export interface Document {
  id: string;
  path: string;
  name: string;
  type: string;
  size: number;
  content?: string;
  metadata?: {
    [key: string]: any;
  };
  createdAt?: Date;
  modifiedAt?: Date;
}

export interface DocumentMatch {
  sourceDocument: Document;
  targetDocument: Document;
  confidence: number;
  matchType: 'exact' | 'fuzzy' | 'semantic';
  matchDetails?: {
    field?: string;
    score?: number;
    [key: string]: any;
  };
}

export interface MatchResult {
  matches: DocumentMatch[];
  unmatched: Document[];
  totalProcessed: number;
  timestamp: Date;
}
