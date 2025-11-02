/**
 * Claude Service
 *
 * Integration with Anthropic's Claude API for cloud-based AI processing
 * with advanced capabilities and fallback support.
 */

import {
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  LLMProvider,
  ClaudeConfig,
  AIServiceError,
  AIErrorType
} from './types';

/**
 * Claude API message format
 */
interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Claude API request format
 */
interface ClaudeRequest {
  model: string;
  messages: ClaudeMessage[];
  system?: string;
  max_tokens: number;
  temperature?: number;
  stop_sequences?: string[];
  stream?: boolean;
}

/**
 * Claude API response format
 */
interface ClaudeResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<{
    type: 'text';
    text: string;
  }>;
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence';
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Claude API stream event
 */
interface ClaudeStreamEvent {
  type: string;
  index?: number;
  delta?: {
    type: string;
    text?: string;
  };
  message?: ClaudeResponse;
}

/**
 * ClaudeService - Cloud AI integration with retry logic
 */
export class ClaudeService {
  private config: ClaudeConfig;
  private readonly BASE_URL = 'https://api.anthropic.com/v1';
  private requestCount = 0;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff

  constructor(config: ClaudeConfig) {
    this.config = config;
  }

  /**
   * Generate completion from Claude
   */
  async generate(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    let lastError: Error | undefined;

    // Retry logic
    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      try {
        const response = await this.makeRequest(request);
        const latencyMs = Date.now() - startTime;

        return {
          content: response.content[0].text,
          provider: LLMProvider.CLAUDE,
          model: response.model,
          finishReason: this.mapStopReason(response.stop_reason),
          usage: {
            promptTokens: response.usage.input_tokens,
            completionTokens: response.usage.output_tokens,
            totalTokens: response.usage.input_tokens + response.usage.output_tokens
          },
          latencyMs
        };

      } catch (error) {
        lastError = error as Error;

        // Check if error is retryable
        if (error instanceof AIServiceError) {
          if (!error.retryable || attempt === this.MAX_RETRIES - 1) {
            throw error;
          }

          // Wait before retry
          await this.delay(this.RETRY_DELAYS[attempt]);
          continue;
        }

        // Unknown error - don't retry
        throw error;
      }
    }

    // All retries exhausted
    throw new AIServiceError(
      `Claude request failed after ${this.MAX_RETRIES} attempts: ${lastError?.message}`,
      AIErrorType.UNKNOWN,
      LLMProvider.CLAUDE,
      false,
      lastError
    );
  }

  /**
   * Generate streaming completion from Claude
   */
  async *generateStream(request: LLMRequest): AsyncGenerator<LLMStreamChunk> {
    try {
      const claudeRequest = this.buildRequest(request, true);

      const response = await fetch(`${this.BASE_URL}/messages`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(claudeRequest),
        signal: AbortSignal.timeout(this.config.timeout)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw this.handleError(response.status, errorData);
      }

      // Stream response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new AIServiceError(
          'No response body',
          AIErrorType.UNKNOWN,
          LLMProvider.CLAUDE
        );
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let currentModel = request.model || this.config.defaultModel;

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue;

          const data = line.slice(6); // Remove 'data: ' prefix
          if (data === '[DONE]') {
            yield {
              content: '',
              done: true,
              provider: LLMProvider.CLAUDE,
              model: currentModel
            };
            return;
          }

          try {
            const event: ClaudeStreamEvent = JSON.parse(data);

            if (event.type === 'content_block_delta' && event.delta?.text) {
              yield {
                content: event.delta.text,
                done: false,
                provider: LLMProvider.CLAUDE,
                model: currentModel
              };
            }

            if (event.type === 'message_start' && event.message) {
              currentModel = event.message.model;
            }

          } catch (e) {
            // Skip invalid JSON
            continue;
          }
        }
      }

    } catch (error) {
      if (error instanceof AIServiceError) {
        throw error;
      }

      throw new AIServiceError(
        `Claude streaming failed: ${(error as Error).message}`,
        AIErrorType.UNKNOWN,
        LLMProvider.CLAUDE,
        true,
        error as Error
      );
    }
  }

  /**
   * Make request to Claude API
   */
  private async makeRequest(request: LLMRequest): Promise<ClaudeResponse> {
    const claudeRequest = this.buildRequest(request, false);

    const response = await fetch(`${this.BASE_URL}/messages`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(claudeRequest),
      signal: AbortSignal.timeout(this.config.timeout)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw this.handleError(response.status, errorData);
    }

    return response.json();
  }

  /**
   * Build Claude API request
   */
  private buildRequest(request: LLMRequest, stream: boolean): ClaudeRequest {
    return {
      model: request.model || this.config.defaultModel,
      messages: [
        {
          role: 'user',
          content: request.prompt
        }
      ],
      system: request.systemPrompt,
      max_tokens: request.maxTokens || this.config.maxTokens,
      temperature: request.temperature,
      stop_sequences: request.stopSequences,
      stream
    };
  }

  /**
   * Get request headers
   */
  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.config.apiKey,
      'anthropic-version': '2023-06-01'
    };
  }

  /**
   * Handle API errors
   */
  private handleError(status: number, errorData: any): AIServiceError {
    const message = errorData.error?.message || 'Unknown error';

    switch (status) {
      case 401:
        return new AIServiceError(
          `Authentication failed: ${message}`,
          AIErrorType.AUTHENTICATION,
          LLMProvider.CLAUDE,
          false
        );
      case 429:
        return new AIServiceError(
          `Rate limit exceeded: ${message}`,
          AIErrorType.RATE_LIMIT,
          LLMProvider.CLAUDE,
          true
        );
      case 400:
        return new AIServiceError(
          `Invalid request: ${message}`,
          AIErrorType.INVALID_REQUEST,
          LLMProvider.CLAUDE,
          false
        );
      case 500:
      case 502:
      case 503:
      case 504:
        return new AIServiceError(
          `Claude API error: ${message}`,
          AIErrorType.UNKNOWN,
          LLMProvider.CLAUDE,
          true
        );
      default:
        return new AIServiceError(
          `Request failed: ${message}`,
          AIErrorType.UNKNOWN,
          LLMProvider.CLAUDE,
          false
        );
    }
  }

  /**
   * Map Claude stop reason to standard format
   */
  private mapStopReason(stopReason: string): 'stop' | 'length' | 'error' {
    switch (stopReason) {
      case 'end_turn':
      case 'stop_sequence':
        return 'stop';
      case 'max_tokens':
        return 'length';
      default:
        return 'error';
    }
  }

  /**
   * Check if Claude API is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Make a minimal request to check availability
      const response = await fetch(`${this.BASE_URL}/messages`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: this.config.defaultModel,
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1
        }),
        signal: AbortSignal.timeout(5000)
      });

      return response.ok || response.status === 429; // 429 means API is available but rate limited
    } catch {
      return false;
    }
  }

  /**
   * Delay helper for retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
