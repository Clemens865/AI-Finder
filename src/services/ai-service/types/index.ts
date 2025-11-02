/**
 * AI Service Types
 *
 * Type definitions for the AI service layer including LLM providers,
 * prompts, embeddings, and command parsing.
 */

// ============================================================================
// LLM Provider Types
// ============================================================================

/**
 * Supported LLM provider types
 */
export enum LLMProvider {
  OLLAMA = 'ollama',
  CLAUDE = 'claude',
  AUTO = 'auto' // Automatically select based on availability and requirements
}

/**
 * LLM model configuration
 */
export interface LLMModel {
  provider: LLMProvider;
  name: string;
  maxTokens: number;
  temperature: number;
  contextWindow: number;
  supportsStreaming: boolean;
  supportsFunctions: boolean;
  costPerToken?: number; // Cost in USD per 1000 tokens (for cloud providers)
}

/**
 * LLM request configuration
 */
export interface LLMRequest {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  stopSequences?: string[];
  stream?: boolean;
  model?: string;
  provider?: LLMProvider;
}

/**
 * LLM response structure
 */
export interface LLMResponse {
  content: string;
  provider: LLMProvider;
  model: string;
  finishReason: 'stop' | 'length' | 'error';
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
  cached?: boolean;
}

/**
 * Streaming response chunk
 */
export interface LLMStreamChunk {
  content: string;
  done: boolean;
  provider: LLMProvider;
  model: string;
}

// ============================================================================
// Router Types
// ============================================================================

/**
 * Router configuration for intelligent LLM selection
 */
export interface RouterConfig {
  preferLocal: boolean;
  fallbackToCloud: boolean;
  maxLocalLatencyMs: number;
  maxRetries: number;
  retryDelayMs: number;
  cacheResponses: boolean;
  cacheTTLSeconds: number;
}

/**
 * Router decision result
 */
export interface RouterDecision {
  provider: LLMProvider;
  model: string;
  reason: string;
  confidence: number;
}

// ============================================================================
// Embedding Types
// ============================================================================

/**
 * Embedding generation request
 */
export interface EmbeddingRequest {
  text: string | string[];
  model?: string;
  normalize?: boolean;
}

/**
 * Embedding response
 */
export interface EmbeddingResponse {
  embeddings: number[][];
  model: string;
  dimensions: number;
  latencyMs: number;
}

/**
 * Supported embedding models
 */
export enum EmbeddingModel {
  SENTENCE_TRANSFORMERS = 'all-MiniLM-L6-v2',
  MULTILINGUAL = 'paraphrase-multilingual-MiniLM-L12-v2',
  SEMANTIC_SEARCH = 'multi-qa-MiniLM-L6-cos-v1'
}

// ============================================================================
// Prompt Types
// ============================================================================

/**
 * Prompt template structure
 */
export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  userPromptTemplate: string;
  variables: string[];
  examples?: PromptExample[];
  metadata?: {
    domain?: string;
    useCase?: string;
    version?: string;
  };
}

/**
 * Prompt example for few-shot learning
 */
export interface PromptExample {
  input: Record<string, string>;
  output: string;
}

/**
 * Prompt rendering context
 */
export interface PromptContext {
  variables: Record<string, string>;
  includeExamples?: boolean;
  maxExamples?: number;
}

// ============================================================================
// Command Parser Types
// ============================================================================

/**
 * Parsed command intent
 */
export enum CommandIntent {
  SEARCH = 'search',
  MATCH = 'match',
  EXTRACT = 'extract',
  ORGANIZE = 'organize',
  SUMMARIZE = 'summarize',
  ANALYZE = 'analyze',
  UNKNOWN = 'unknown'
}

/**
 * Parsed command structure
 */
export interface ParsedCommand {
  intent: CommandIntent;
  confidence: number;
  parameters: Record<string, any>;
  originalText: string;
  timestamp: Date;
}

/**
 * Command parsing result
 */
export interface CommandParseResult {
  success: boolean;
  command?: ParsedCommand;
  error?: string;
  suggestions?: string[];
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * AI service error types
 */
export enum AIErrorType {
  PROVIDER_UNAVAILABLE = 'provider_unavailable',
  RATE_LIMIT = 'rate_limit',
  AUTHENTICATION = 'authentication',
  INVALID_REQUEST = 'invalid_request',
  TIMEOUT = 'timeout',
  UNKNOWN = 'unknown'
}

/**
 * AI service error
 */
export class AIServiceError extends Error {
  constructor(
    message: string,
    public type: AIErrorType,
    public provider?: LLMProvider,
    public retryable: boolean = false,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'AIServiceError';
  }
}

// ============================================================================
// Service Configuration Types
// ============================================================================

/**
 * Ollama configuration
 */
export interface OllamaConfig {
  baseUrl: string;
  defaultModel: string;
  timeout: number;
  keepAlive?: number;
}

/**
 * Claude API configuration
 */
export interface ClaudeConfig {
  apiKey: string;
  defaultModel: string;
  maxTokens: number;
  timeout: number;
}

/**
 * AI Service configuration
 */
export interface AIServiceConfig {
  ollama: OllamaConfig;
  claude: ClaudeConfig;
  router: RouterConfig;
  embeddings: {
    model: EmbeddingModel;
    batchSize: number;
    cacheEnabled: boolean;
  };
}

// ============================================================================
// Cache Types
// ============================================================================

/**
 * Cache entry
 */
export interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  ttl: number;
  hits: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}
