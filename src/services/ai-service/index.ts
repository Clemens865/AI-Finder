/**
 * AI Service - Main Export
 *
 * Complete AI integration for Intelligent Finder including:
 * - Local and cloud LLM routing
 * - Embedding generation
 * - Command parsing
 * - Prompt management
 * - Streaming responses
 */

// Main service
export { AIService, getAIService, resetAIService } from './AIService';

// Core services
export { LLMRouter } from './LLMRouter';
export { OllamaService } from './OllamaService';
export { ClaudeService } from './ClaudeService';
export { PromptLibrary } from './prompts/PromptLibrary';
export { EmbeddingService } from './embeddings/EmbeddingService';
export { CommandParser } from './CommandParser';
export { StreamHandler, StreamEventType } from './StreamHandler';

// Types
export * from './types';

// Re-export specific types for convenience
export type {
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  EmbeddingRequest,
  EmbeddingResponse,
  PromptTemplate,
  ParsedCommand,
  CommandParseResult,
  AIServiceConfig,
  RouterDecision
} from './types';

export {
  LLMProvider,
  CommandIntent,
  AIErrorType,
  AIServiceError,
  EmbeddingModel
} from './types';
