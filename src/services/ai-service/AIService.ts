/**
 * AI Service
 *
 * Main orchestration layer for all AI functionality including LLM routing,
 * embeddings, command parsing, and prompt management.
 */

import {
  AIServiceConfig,
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  LLMProvider,
  EmbeddingRequest,
  EmbeddingResponse,
  CommandParseResult,
  AIServiceError,
  AIErrorType
} from './types';
import { LLMRouter } from './LLMRouter';
import { OllamaService } from './OllamaService';
import { ClaudeService } from './ClaudeService';
import { PromptLibrary } from './prompts/PromptLibrary';
import { EmbeddingService } from './embeddings/EmbeddingService';
import { CommandParser } from './CommandParser';
import { StreamHandler } from './StreamHandler';

/**
 * Default configuration
 */
const DEFAULT_CONFIG: AIServiceConfig = {
  ollama: {
    baseUrl: 'http://localhost:11434',
    defaultModel: 'llama3.2:latest',
    timeout: 60000,
    keepAlive: 300
  },
  claude: {
    apiKey: process.env.CLAUDE_API_KEY || '',
    defaultModel: 'claude-3-5-sonnet-20241022',
    maxTokens: 4096,
    timeout: 60000
  },
  router: {
    preferLocal: true,
    fallbackToCloud: true,
    maxLocalLatencyMs: 5000,
    maxRetries: 3,
    retryDelayMs: 1000,
    cacheResponses: true,
    cacheTTLSeconds: 3600
  },
  embeddings: {
    model: 'all-MiniLM-L6-v2' as any,
    batchSize: 32,
    cacheEnabled: true
  }
};

/**
 * AIService - Complete AI integration layer
 */
export class AIService {
  private config: AIServiceConfig;
  private router: LLMRouter;
  private ollamaService: OllamaService;
  private claudeService: ClaudeService;
  private promptLibrary: PromptLibrary;
  private embeddingService: EmbeddingService;
  private commandParser: CommandParser;
  private streamHandler: StreamHandler;

  constructor(config: Partial<AIServiceConfig> = {}) {
    // Merge with default config
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      ollama: { ...DEFAULT_CONFIG.ollama, ...config.ollama },
      claude: { ...DEFAULT_CONFIG.claude, ...config.claude },
      router: { ...DEFAULT_CONFIG.router, ...config.router },
      embeddings: { ...DEFAULT_CONFIG.embeddings, ...config.embeddings }
    };

    // Initialize services
    this.router = new LLMRouter(this.config.router);
    this.ollamaService = new OllamaService(this.config.ollama);
    this.claudeService = new ClaudeService(this.config.claude);
    this.promptLibrary = new PromptLibrary();
    this.embeddingService = new EmbeddingService(
      this.config.embeddings.model,
      this.config.embeddings.batchSize,
      this.config.embeddings.cacheEnabled
    );
    this.commandParser = new CommandParser(this);
    this.streamHandler = new StreamHandler();
  }

  // ============================================================================
  // LLM Generation
  // ============================================================================

  /**
   * Generate completion from LLM with automatic routing
   */
  async generate(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      // Route request
      const decision = await this.router.route(request);

      // Select appropriate service
      const service = decision.provider === LLMProvider.OLLAMA
        ? this.ollamaService
        : this.claudeService;

      // Generate response
      const response = await service.generate({
        ...request,
        provider: decision.provider,
        model: request.model || decision.model
      });

      // Record success
      this.router.recordSuccess(decision.provider, Date.now() - startTime);

      return response;

    } catch (error) {
      if (error instanceof AIServiceError) {
        // Record failure
        if (error.provider) {
          this.router.recordFailure(error.provider);
        }

        // Attempt fallback if retryable
        if (error.retryable && this.config.router.fallbackToCloud) {
          return this.attemptFallback(request, error);
        }
      }

      throw error;
    }
  }

  /**
   * Generate streaming completion
   */
  async *generateStream(request: LLMRequest): AsyncGenerator<LLMStreamChunk> {
    try {
      // Route request
      const decision = await this.router.route(request);

      // Select appropriate service
      const service = decision.provider === LLMProvider.OLLAMA
        ? this.ollamaService
        : this.claudeService;

      // Stream response
      yield* service.generateStream({
        ...request,
        provider: decision.provider,
        model: request.model || decision.model
      });

    } catch (error) {
      if (error instanceof AIServiceError && error.retryable && this.config.router.fallbackToCloud) {
        // Try fallback provider
        const fallbackProvider = error.provider === LLMProvider.OLLAMA
          ? LLMProvider.CLAUDE
          : LLMProvider.OLLAMA;

        const service = fallbackProvider === LLMProvider.OLLAMA
          ? this.ollamaService
          : this.claudeService;

        yield* service.generateStream({
          ...request,
          provider: fallbackProvider
        });
      } else {
        throw error;
      }
    }
  }

  /**
   * Attempt fallback to alternative provider
   */
  private async attemptFallback(request: LLMRequest, originalError: AIServiceError): Promise<LLMResponse> {
    const fallbackProvider = originalError.provider === LLMProvider.OLLAMA
      ? LLMProvider.CLAUDE
      : LLMProvider.OLLAMA;

    const service = fallbackProvider === LLMProvider.OLLAMA
      ? this.ollamaService
      : this.claudeService;

    try {
      return await service.generate({
        ...request,
        provider: fallbackProvider
      });
    } catch (fallbackError) {
      // Both providers failed, throw original error
      throw originalError;
    }
  }

  // ============================================================================
  // Prompt Management
  // ============================================================================

  /**
   * Generate using prompt template
   */
  async generateFromTemplate(
    templateId: string,
    variables: Record<string, string>,
    options: Partial<LLMRequest> = {}
  ): Promise<LLMResponse> {
    const { systemPrompt, userPrompt } = this.promptLibrary.render(templateId, {
      variables,
      includeExamples: options.temperature && options.temperature < 0.5
    });

    return this.generate({
      ...options,
      prompt: userPrompt,
      systemPrompt
    });
  }

  /**
   * Get prompt library
   */
  getPromptLibrary(): PromptLibrary {
    return this.promptLibrary;
  }

  // ============================================================================
  // Embeddings
  // ============================================================================

  /**
   * Generate embeddings
   */
  async generateEmbeddings(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    return this.embeddingService.generateEmbeddings(request);
  }

  /**
   * Find similar texts using embeddings
   */
  async findSimilar(
    query: string,
    candidates: string[],
    topK: number = 5
  ): Promise<Array<{ text: string; similarity: number; index: number }>> {
    return this.embeddingService.findSimilar(query, candidates, topK);
  }

  /**
   * Get embedding service
   */
  getEmbeddingService(): EmbeddingService {
    return this.embeddingService;
  }

  // ============================================================================
  // Command Parsing
  // ============================================================================

  /**
   * Parse natural language command
   */
  async parseCommand(command: string): Promise<CommandParseResult> {
    return this.commandParser.parse(command);
  }

  /**
   * Get command suggestions
   */
  suggestCommands(partial: string): string[] {
    return this.commandParser.suggestCommands(partial);
  }

  /**
   * Get command parser
   */
  getCommandParser(): CommandParser {
    return this.commandParser;
  }

  // ============================================================================
  // Streaming
  // ============================================================================

  /**
   * Start managed stream
   */
  async startStream(
    streamId: string,
    request: LLMRequest,
    options: any = {}
  ): Promise<string> {
    const generator = this.generateStream(request);
    return this.streamHandler.startStream(streamId, generator, options);
  }

  /**
   * Cancel stream
   */
  cancelStream(streamId: string): void {
    this.streamHandler.cancelStream(streamId);
  }

  /**
   * Get stream handler
   */
  getStreamHandler(): StreamHandler {
    return this.streamHandler;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Check service health
   */
  async healthCheck(): Promise<{
    ollama: boolean;
    claude: boolean;
    overall: boolean;
  }> {
    const [ollamaAvailable, claudeAvailable] = await Promise.all([
      this.ollamaService.isAvailable(),
      this.claudeService.isAvailable()
    ]);

    return {
      ollama: ollamaAvailable,
      claude: claudeAvailable,
      overall: ollamaAvailable || claudeAvailable
    };
  }

  /**
   * Get provider statistics
   */
  getProviderStats() {
    return this.router.getProviderStats();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AIServiceConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      ollama: { ...this.config.ollama, ...config.ollama },
      claude: { ...this.config.claude, ...config.claude },
      router: { ...this.config.router, ...config.router },
      embeddings: { ...this.config.embeddings, ...config.embeddings }
    };

    // Reinitialize affected services
    if (config.router) {
      this.router = new LLMRouter(this.config.router);
    }

    if (config.ollama) {
      this.ollamaService = new OllamaService(this.config.ollama);
    }

    if (config.claude) {
      this.claudeService = new ClaudeService(this.config.claude);
    }

    if (config.embeddings) {
      this.embeddingService = new EmbeddingService(
        this.config.embeddings.model,
        this.config.embeddings.batchSize,
        this.config.embeddings.cacheEnabled
      );
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): AIServiceConfig {
    return { ...this.config };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // Clear caches
    this.embeddingService.clearCache();

    // Cleanup old streams
    this.streamHandler.cleanup();
  }
}

// Export singleton instance factory
let instance: AIService | null = null;

export function getAIService(config?: Partial<AIServiceConfig>): AIService {
  if (!instance || config) {
    instance = new AIService(config);
  }
  return instance;
}

export function resetAIService(): void {
  instance = null;
}
