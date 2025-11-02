/**
 * Ollama Service
 *
 * Integration with local Ollama LLM server for privacy-first,
 * high-performance local AI processing.
 */

import {
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  LLMProvider,
  OllamaConfig,
  AIServiceError,
  AIErrorType
} from './types';

/**
 * Ollama API request format
 */
interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  system?: string;
  stream?: boolean;
  options?: {
    temperature?: number;
    num_predict?: number;
    stop?: string[];
  };
}

/**
 * Ollama API response format
 */
interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

/**
 * OllamaService - Local LLM integration
 */
export class OllamaService {
  private config: OllamaConfig;
  private abortControllers: Map<string, AbortController>;

  constructor(config: OllamaConfig) {
    this.config = config;
    this.abortControllers = new Map();
  }

  /**
   * Generate completion from Ollama
   */
  async generate(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      // Create abort controller for timeout
      const abortController = new AbortController();
      this.abortControllers.set(requestId, abortController);

      // Set timeout
      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, this.config.timeout);

      // Prepare request
      const ollamaRequest: OllamaGenerateRequest = {
        model: request.model || this.config.defaultModel,
        prompt: request.prompt,
        system: request.systemPrompt,
        stream: false,
        options: {
          temperature: request.temperature,
          num_predict: request.maxTokens,
          stop: request.stopSequences
        }
      };

      // Make request
      const response = await fetch(`${this.config.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(ollamaRequest),
        signal: abortController.signal
      });

      clearTimeout(timeoutId);
      this.abortControllers.delete(requestId);

      if (!response.ok) {
        throw new AIServiceError(
          `Ollama API error: ${response.statusText}`,
          AIErrorType.UNKNOWN,
          LLMProvider.OLLAMA,
          response.status >= 500
        );
      }

      // Parse response
      const data: OllamaGenerateResponse = await response.json();

      const latencyMs = Date.now() - startTime;

      return {
        content: data.response,
        provider: LLMProvider.OLLAMA,
        model: data.model,
        finishReason: data.done ? 'stop' : 'length',
        usage: {
          promptTokens: data.prompt_eval_count || 0,
          completionTokens: data.eval_count || 0,
          totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0)
        },
        latencyMs
      };

    } catch (error) {
      this.abortControllers.delete(requestId);

      if (error instanceof AIServiceError) {
        throw error;
      }

      if ((error as Error).name === 'AbortError') {
        throw new AIServiceError(
          'Request timeout',
          AIErrorType.TIMEOUT,
          LLMProvider.OLLAMA,
          true
        );
      }

      throw new AIServiceError(
        `Ollama generation failed: ${(error as Error).message}`,
        AIErrorType.UNKNOWN,
        LLMProvider.OLLAMA,
        true,
        error as Error
      );
    }
  }

  /**
   * Generate streaming completion from Ollama
   */
  async *generateStream(request: LLMRequest): AsyncGenerator<LLMStreamChunk> {
    const requestId = this.generateRequestId();

    try {
      // Create abort controller
      const abortController = new AbortController();
      this.abortControllers.set(requestId, abortController);

      // Prepare request
      const ollamaRequest: OllamaGenerateRequest = {
        model: request.model || this.config.defaultModel,
        prompt: request.prompt,
        system: request.systemPrompt,
        stream: true,
        options: {
          temperature: request.temperature,
          num_predict: request.maxTokens,
          stop: request.stopSequences
        }
      };

      // Make request
      const response = await fetch(`${this.config.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(ollamaRequest),
        signal: abortController.signal
      });

      if (!response.ok) {
        throw new AIServiceError(
          `Ollama API error: ${response.statusText}`,
          AIErrorType.UNKNOWN,
          LLMProvider.OLLAMA,
          response.status >= 500
        );
      }

      // Stream response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new AIServiceError(
          'No response body',
          AIErrorType.UNKNOWN,
          LLMProvider.OLLAMA
        );
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const data: OllamaGenerateResponse = JSON.parse(line);

            yield {
              content: data.response,
              done: data.done,
              provider: LLMProvider.OLLAMA,
              model: data.model
            };

            if (data.done) {
              this.abortControllers.delete(requestId);
              return;
            }
          } catch (e) {
            // Skip invalid JSON
            continue;
          }
        }
      }

      this.abortControllers.delete(requestId);

    } catch (error) {
      this.abortControllers.delete(requestId);

      if (error instanceof AIServiceError) {
        throw error;
      }

      throw new AIServiceError(
        `Ollama streaming failed: ${(error as Error).message}`,
        AIErrorType.UNKNOWN,
        LLMProvider.OLLAMA,
        true,
        error as Error
      );
    }
  }

  /**
   * Check if Ollama is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/version`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * List available models
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`, {
        method: 'GET'
      });

      if (!response.ok) {
        throw new AIServiceError(
          'Failed to list models',
          AIErrorType.UNKNOWN,
          LLMProvider.OLLAMA
        );
      }

      const data = await response.json();
      return data.models?.map((m: any) => m.name) || [];
    } catch (error) {
      if (error instanceof AIServiceError) {
        throw error;
      }
      throw new AIServiceError(
        `Failed to list models: ${(error as Error).message}`,
        AIErrorType.UNKNOWN,
        LLMProvider.OLLAMA,
        false,
        error as Error
      );
    }
  }

  /**
   * Cancel a request
   */
  cancelRequest(requestId: string): void {
    const controller = this.abortControllers.get(requestId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(requestId);
    }
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `ollama-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }
}
