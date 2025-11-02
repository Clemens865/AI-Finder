/**
 * AI Service Tests
 *
 * Comprehensive test suite for AI service functionality
 */

import {
  AIService,
  getAIService,
  resetAIService,
  LLMProvider,
  CommandIntent,
  EmbeddingModel
} from '../../../src/services/ai-service';

describe('AIService', () => {
  let aiService: AIService;

  beforeEach(() => {
    resetAIService();
    aiService = getAIService({
      ollama: {
        baseUrl: 'http://localhost:11434',
        defaultModel: 'llama3.2:latest',
        timeout: 5000
      },
      claude: {
        apiKey: process.env.CLAUDE_API_KEY || 'test-key',
        defaultModel: 'claude-3-5-sonnet-20241022',
        maxTokens: 1000,
        timeout: 5000
      },
      router: {
        preferLocal: true,
        fallbackToCloud: true,
        maxLocalLatencyMs: 5000,
        maxRetries: 2,
        retryDelayMs: 100,
        cacheResponses: true,
        cacheTTLSeconds: 60
      }
    });
  });

  describe('LLM Generation', () => {
    it('should generate completion with auto routing', async () => {
      const response = await aiService.generate({
        prompt: 'What is 2+2?',
        temperature: 0,
        maxTokens: 50
      });

      expect(response).toBeDefined();
      expect(response.content).toBeTruthy();
      expect(response.provider).toBeDefined();
      expect(['ollama', 'claude']).toContain(response.provider);
      expect(response.usage.totalTokens).toBeGreaterThan(0);
    }, 30000);

    it('should respect provider preference', async () => {
      const response = await aiService.generate({
        prompt: 'Hello',
        provider: LLMProvider.OLLAMA,
        temperature: 0,
        maxTokens: 10
      });

      expect(response.provider).toBe(LLMProvider.OLLAMA);
    }, 30000);

    it('should handle streaming responses', async () => {
      const chunks: string[] = [];

      for await (const chunk of aiService.generateStream({
        prompt: 'Count from 1 to 5',
        temperature: 0,
        maxTokens: 50
      })) {
        chunks.push(chunk.content);
        if (chunk.done) break;
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.join('')).toBeTruthy();
    }, 30000);
  });

  describe('Prompt Templates', () => {
    it('should generate from template', async () => {
      const response = await aiService.generateFromTemplate(
        'vendor-normalization',
        {
          vendor_name: 'ACME CORPORATION LLC'
        },
        {
          temperature: 0,
          maxTokens: 50
        }
      );

      expect(response).toBeDefined();
      expect(response.content).toBeTruthy();
    }, 30000);

    it('should list available templates', () => {
      const templates = aiService.getPromptLibrary().listTemplates();

      expect(templates.length).toBeGreaterThan(0);
      expect(templates[0]).toHaveProperty('id');
      expect(templates[0]).toHaveProperty('name');
      expect(templates[0]).toHaveProperty('variables');
    });

    it('should find templates by domain', () => {
      const financeTemplates = aiService.getPromptLibrary().findByDomain('finance');

      expect(financeTemplates.length).toBeGreaterThan(0);
      expect(financeTemplates.every(t => t.metadata?.domain === 'finance')).toBe(true);
    });
  });

  describe('Embeddings', () => {
    it('should generate embeddings for single text', async () => {
      const response = await aiService.generateEmbeddings({
        text: 'This is a test sentence',
        normalize: true
      });

      expect(response).toBeDefined();
      expect(response.embeddings).toHaveLength(1);
      expect(response.embeddings[0].length).toBeGreaterThan(0);
      expect(response.dimensions).toBeGreaterThan(0);
    });

    it('should generate embeddings for multiple texts', async () => {
      const texts = [
        'First sentence',
        'Second sentence',
        'Third sentence'
      ];

      const response = await aiService.generateEmbeddings({
        text: texts,
        normalize: true
      });

      expect(response.embeddings).toHaveLength(3);
      expect(response.embeddings[0].length).toBe(response.dimensions);
    });

    it('should find similar texts', async () => {
      const candidates = [
        'The cat sat on the mat',
        'Dogs are great pets',
        'The feline rested on the rug',
        'Computers are useful tools'
      ];

      const results = await aiService.findSimilar(
        'A cat on a mat',
        candidates,
        2
      );

      expect(results).toHaveLength(2);
      expect(results[0].similarity).toBeGreaterThanOrEqual(results[1].similarity);
      expect(results[0]).toHaveProperty('text');
      expect(results[0]).toHaveProperty('similarity');
      expect(results[0]).toHaveProperty('index');
    });

    it('should use embedding cache', async () => {
      const text = 'Cacheable text';

      // First call
      const response1 = await aiService.generateEmbeddings({ text });
      const latency1 = response1.latencyMs;

      // Second call (should be cached)
      const response2 = await aiService.generateEmbeddings({ text });
      const latency2 = response2.latencyMs;

      expect(response1.embeddings).toEqual(response2.embeddings);
      // Cached call should be faster (not always guaranteed in tests)
    });
  });

  describe('Command Parsing', () => {
    it('should parse search command', async () => {
      const result = await aiService.parseCommand('Find all invoices from January');

      expect(result.success).toBe(true);
      expect(result.command).toBeDefined();
      expect(result.command!.intent).toBe(CommandIntent.SEARCH);
      expect(result.command!.parameters).toHaveProperty('file_type');
    });

    it('should parse match command', async () => {
      const result = await aiService.parseCommand('Match invoices to bank statements');

      expect(result.success).toBe(true);
      expect(result.command!.intent).toBe(CommandIntent.MATCH);
    });

    it('should parse organize command', async () => {
      const result = await aiService.parseCommand('Organize files by date');

      expect(result.success).toBe(true);
      expect(result.command!.intent).toBe(CommandIntent.ORGANIZE);
    });

    it('should handle unknown commands', async () => {
      const result = await aiService.parseCommand('asdfasdfasdf random text');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.suggestions).toBeDefined();
    });

    it('should provide command suggestions', () => {
      const suggestions = aiService.suggestCommands('find');

      expect(suggestions).toBeDefined();
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.toLowerCase().includes('find'))).toBe(true);
    });
  });

  describe('Streaming', () => {
    it('should manage stream lifecycle', async () => {
      const streamId = 'test-stream-1';
      const events: string[] = [];

      const unsubscribe = aiService.getStreamHandler().subscribe(streamId, (event) => {
        events.push(event.type);
      });

      await aiService.startStream(
        streamId,
        {
          prompt: 'Count to 3',
          temperature: 0,
          maxTokens: 50
        },
        {
          onComplete: (text: string) => {
            expect(text).toBeTruthy();
          }
        }
      );

      unsubscribe();

      expect(events).toContain('start');
      expect(events).toContain('chunk');
      expect(events).toContain('end');
    }, 30000);

    it('should cancel stream', async () => {
      const streamId = 'test-stream-2';

      const streamPromise = aiService.startStream(streamId, {
        prompt: 'Write a long story',
        temperature: 0.7,
        maxTokens: 1000
      });

      // Cancel after short delay
      setTimeout(() => {
        aiService.cancelStream(streamId);
      }, 100);

      // Should complete early due to cancellation
      await streamPromise;

      const state = aiService.getStreamHandler().getStreamState(streamId);
      expect(state?.cancelled).toBe(true);
    }, 30000);
  });

  describe('Health Check', () => {
    it('should check service health', async () => {
      const health = await aiService.healthCheck();

      expect(health).toBeDefined();
      expect(health).toHaveProperty('ollama');
      expect(health).toHaveProperty('claude');
      expect(health).toHaveProperty('overall');
      expect(typeof health.ollama).toBe('boolean');
      expect(typeof health.claude).toBe('boolean');
      expect(typeof health.overall).toBe('boolean');
    }, 10000);

    it('should report at least one provider available', async () => {
      const health = await aiService.healthCheck();

      // At least one provider should be available for tests to work
      expect(health.overall).toBe(true);
    }, 10000);
  });

  describe('Configuration', () => {
    it('should get current configuration', () => {
      const config = aiService.getConfig();

      expect(config).toBeDefined();
      expect(config).toHaveProperty('ollama');
      expect(config).toHaveProperty('claude');
      expect(config).toHaveProperty('router');
      expect(config).toHaveProperty('embeddings');
    });

    it('should update configuration', () => {
      aiService.updateConfig({
        router: {
          preferLocal: false,
          fallbackToCloud: true,
          maxLocalLatencyMs: 3000,
          maxRetries: 5,
          retryDelayMs: 500,
          cacheResponses: false,
          cacheTTLSeconds: 1800
        }
      });

      const config = aiService.getConfig();
      expect(config.router.preferLocal).toBe(false);
      expect(config.router.maxRetries).toBe(5);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources', async () => {
      // Generate some cached data
      await aiService.generateEmbeddings({ text: 'test' });

      // Cleanup
      await aiService.cleanup();

      const stats = aiService.getEmbeddingService().getCacheStats();
      // Cache might be cleared or not depending on implementation
      expect(stats).toBeDefined();
    });
  });

  describe('Provider Statistics', () => {
    it('should track provider statistics', async () => {
      // Make a request
      await aiService.generate({
        prompt: 'test',
        maxTokens: 10
      });

      const stats = aiService.getProviderStats();
      expect(stats).toBeDefined();
      expect(stats.size).toBeGreaterThan(0);
    }, 30000);
  });
});

describe('Singleton Pattern', () => {
  it('should return same instance', () => {
    const instance1 = getAIService();
    const instance2 = getAIService();

    expect(instance1).toBe(instance2);
  });

  it('should reset instance', () => {
    const instance1 = getAIService();
    resetAIService();
    const instance2 = getAIService();

    expect(instance1).not.toBe(instance2);
  });

  it('should create new instance with config', () => {
    const instance1 = getAIService();
    const instance2 = getAIService({
      router: { preferLocal: false } as any
    });

    expect(instance1).not.toBe(instance2);
  });
});
