/**
 * LLM Router
 *
 * Intelligent routing between local (Ollama) and cloud (Claude) LLMs
 * based on availability, performance, and requirements.
 */

import {
  LLMProvider,
  LLMRequest,
  RouterConfig,
  RouterDecision,
  AIServiceError,
  AIErrorType
} from './types';

/**
 * Provider status tracking
 */
interface ProviderStatus {
  available: boolean;
  lastChecked: number;
  consecutiveFailures: number;
  averageLatencyMs: number;
  totalRequests: number;
}

/**
 * LLMRouter - Intelligent routing between local and cloud LLMs
 */
export class LLMRouter {
  private config: RouterConfig;
  private providerStatus: Map<LLMProvider, ProviderStatus>;
  private readonly CHECK_INTERVAL_MS = 60000; // Check availability every minute

  constructor(config: RouterConfig) {
    this.config = config;
    this.providerStatus = new Map();

    // Initialize provider status
    this.providerStatus.set(LLMProvider.OLLAMA, {
      available: false,
      lastChecked: 0,
      consecutiveFailures: 0,
      averageLatencyMs: 0,
      totalRequests: 0
    });

    this.providerStatus.set(LLMProvider.CLAUDE, {
      available: false,
      lastChecked: 0,
      consecutiveFailures: 0,
      averageLatencyMs: 0,
      totalRequests: 0
    });
  }

  /**
   * Route a request to the appropriate LLM provider
   */
  async route(request: LLMRequest): Promise<RouterDecision> {
    // If provider is explicitly specified, use it
    if (request.provider && request.provider !== LLMProvider.AUTO) {
      return {
        provider: request.provider,
        model: request.model || this.getDefaultModel(request.provider),
        reason: 'Explicitly specified by request',
        confidence: 1.0
      };
    }

    // Check provider availability
    await this.updateProviderStatus();

    // Get available providers
    const availableProviders = this.getAvailableProviders();

    if (availableProviders.length === 0) {
      throw new AIServiceError(
        'No LLM providers available',
        AIErrorType.PROVIDER_UNAVAILABLE,
        undefined,
        false
      );
    }

    // Decision logic
    const decision = this.makeRoutingDecision(request, availableProviders);

    return decision;
  }

  /**
   * Make routing decision based on configuration and provider status
   */
  private makeRoutingDecision(
    request: LLMRequest,
    availableProviders: LLMProvider[]
  ): RouterDecision {
    const ollamaStatus = this.providerStatus.get(LLMProvider.OLLAMA);
    const claudeStatus = this.providerStatus.get(LLMProvider.CLAUDE);

    // If only one provider is available, use it
    if (availableProviders.length === 1) {
      const provider = availableProviders[0];
      return {
        provider,
        model: this.getDefaultModel(provider),
        reason: 'Only available provider',
        confidence: 1.0
      };
    }

    // Both providers available - make intelligent decision
    const factors: { provider: LLMProvider; score: number; reasons: string[] }[] = [];

    // Evaluate Ollama
    if (availableProviders.includes(LLMProvider.OLLAMA) && ollamaStatus) {
      const reasons: string[] = [];
      let score = 0;

      // Prefer local if configured
      if (this.config.preferLocal) {
        score += 50;
        reasons.push('Local preference enabled');
      }

      // Performance factor
      if (ollamaStatus.averageLatencyMs < this.config.maxLocalLatencyMs) {
        score += 30;
        reasons.push(`Low latency (${ollamaStatus.averageLatencyMs}ms)`);
      }

      // Reliability factor
      if (ollamaStatus.consecutiveFailures === 0) {
        score += 20;
        reasons.push('No recent failures');
      } else {
        score -= ollamaStatus.consecutiveFailures * 10;
        reasons.push(`${ollamaStatus.consecutiveFailures} recent failures`);
      }

      factors.push({ provider: LLMProvider.OLLAMA, score, reasons });
    }

    // Evaluate Claude
    if (availableProviders.includes(LLMProvider.CLAUDE) && claudeStatus) {
      const reasons: string[] = [];
      let score = 0;

      // Claude gets baseline score
      score += 40;
      reasons.push('Cloud provider baseline');

      // Streaming support
      if (request.stream) {
        score += 20;
        reasons.push('Better streaming support');
      }

      // Reliability factor
      if (claudeStatus.consecutiveFailures === 0) {
        score += 20;
        reasons.push('No recent failures');
      } else {
        score -= claudeStatus.consecutiveFailures * 10;
        reasons.push(`${claudeStatus.consecutiveFailures} recent failures`);
      }

      // Performance factor
      if (claudeStatus.averageLatencyMs < 2000) {
        score += 20;
        reasons.push(`Good latency (${claudeStatus.averageLatencyMs}ms)`);
      }

      factors.push({ provider: LLMProvider.CLAUDE, score, reasons });
    }

    // Select provider with highest score
    factors.sort((a, b) => b.score - a.score);
    const winner = factors[0];

    return {
      provider: winner.provider,
      model: this.getDefaultModel(winner.provider),
      reason: winner.reasons.join('; '),
      confidence: Math.min(winner.score / 100, 1.0)
    };
  }

  /**
   * Update provider availability status
   */
  private async updateProviderStatus(): Promise<void> {
    const now = Date.now();

    // Check Ollama
    const ollamaStatus = this.providerStatus.get(LLMProvider.OLLAMA)!;
    if (now - ollamaStatus.lastChecked > this.CHECK_INTERVAL_MS) {
      try {
        const available = await this.checkOllamaAvailability();
        ollamaStatus.available = available;
        ollamaStatus.lastChecked = now;
        if (available) {
          ollamaStatus.consecutiveFailures = 0;
        }
      } catch (error) {
        ollamaStatus.available = false;
        ollamaStatus.consecutiveFailures++;
        ollamaStatus.lastChecked = now;
      }
    }

    // Check Claude
    const claudeStatus = this.providerStatus.get(LLMProvider.CLAUDE)!;
    if (now - claudeStatus.lastChecked > this.CHECK_INTERVAL_MS) {
      try {
        const available = await this.checkClaudeAvailability();
        claudeStatus.available = available;
        claudeStatus.lastChecked = now;
        if (available) {
          claudeStatus.consecutiveFailures = 0;
        }
      } catch (error) {
        claudeStatus.available = false;
        claudeStatus.consecutiveFailures++;
        claudeStatus.lastChecked = now;
      }
    }
  }

  /**
   * Check if Ollama is available
   */
  private async checkOllamaAvailability(): Promise<boolean> {
    // This will be implemented in OllamaService
    // For now, assume available if local server is running
    return true; // Placeholder
  }

  /**
   * Check if Claude API is available
   */
  private async checkClaudeAvailability(): Promise<boolean> {
    // This will be implemented in ClaudeService
    // For now, check if API key is configured
    return true; // Placeholder
  }

  /**
   * Get available providers
   */
  private getAvailableProviders(): LLMProvider[] {
    const providers: LLMProvider[] = [];

    const ollamaStatus = this.providerStatus.get(LLMProvider.OLLAMA);
    if (ollamaStatus?.available) {
      providers.push(LLMProvider.OLLAMA);
    }

    const claudeStatus = this.providerStatus.get(LLMProvider.CLAUDE);
    if (claudeStatus?.available && this.config.fallbackToCloud) {
      providers.push(LLMProvider.CLAUDE);
    }

    return providers;
  }

  /**
   * Get default model for provider
   */
  private getDefaultModel(provider: LLMProvider): string {
    switch (provider) {
      case LLMProvider.OLLAMA:
        return 'llama3.2:latest';
      case LLMProvider.CLAUDE:
        return 'claude-3-5-sonnet-20241022';
      default:
        return 'llama3.2:latest';
    }
  }

  /**
   * Record request success for provider
   */
  recordSuccess(provider: LLMProvider, latencyMs: number): void {
    const status = this.providerStatus.get(provider);
    if (status) {
      status.consecutiveFailures = 0;
      status.totalRequests++;

      // Update rolling average latency
      const alpha = 0.3; // Smoothing factor
      if (status.averageLatencyMs === 0) {
        status.averageLatencyMs = latencyMs;
      } else {
        status.averageLatencyMs =
          alpha * latencyMs + (1 - alpha) * status.averageLatencyMs;
      }
    }
  }

  /**
   * Record request failure for provider
   */
  recordFailure(provider: LLMProvider): void {
    const status = this.providerStatus.get(provider);
    if (status) {
      status.consecutiveFailures++;
      status.totalRequests++;
    }
  }

  /**
   * Get provider statistics
   */
  getProviderStats(): Map<LLMProvider, ProviderStatus> {
    return new Map(this.providerStatus);
  }

  /**
   * Force provider status update
   */
  async forceStatusUpdate(): Promise<void> {
    // Reset last checked to force update
    this.providerStatus.forEach(status => {
      status.lastChecked = 0;
    });

    await this.updateProviderStatus();
  }
}
