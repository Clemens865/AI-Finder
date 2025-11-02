  # AI Service

Complete AI integration layer for Intelligent Finder with local/cloud LLM routing, embeddings, command parsing, and prompt management.

## Features

### 🤖 Intelligent LLM Routing
- **Auto-routing** between Ollama (local) and Claude (cloud)
- **Fallback mechanisms** for high availability
- **Performance tracking** and adaptive selection
- **Cost optimization** by preferring local processing

### 📝 Prompt Management
- **Template library** with domain-specific prompts
- **Variable substitution** for dynamic prompts
- **Few-shot examples** for better accuracy
- **Reusable templates** across the application

### 🔍 Semantic Embeddings
- **Local embedding generation** for privacy
- **Batch processing** for efficiency
- **Caching** for repeated texts
- **Similarity search** for semantic matching

### 💬 Command Parsing
- **Intent classification** from natural language
- **Parameter extraction** with pattern matching
- **Command suggestions** for auto-complete
- **LLM-enhanced** parsing for complex commands

### 🌊 Streaming Support
- **Real-time responses** with chunked delivery
- **Event-based** architecture for UI updates
- **Buffering** for smooth experience
- **Cancellation** support

## Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Add your CLAUDE_API_KEY to .env
```

## Quick Start

```typescript
import { getAIService } from './services/ai-service';

// Get singleton instance
const aiService = getAIService();

// Generate completion
const response = await aiService.generate({
  prompt: 'Summarize this invoice data',
  temperature: 0.7,
  maxTokens: 500
});

console.log(response.content);
```

## Usage Examples

### LLM Generation

```typescript
// Basic generation with auto-routing
const response = await aiService.generate({
  prompt: 'Extract invoice data from: ...',
  temperature: 0.3,
  maxTokens: 1000
});

// Force specific provider
const response = await aiService.generate({
  prompt: 'Analyze this data',
  provider: LLMProvider.OLLAMA,
  model: 'llama3.2:latest'
});

// Streaming response
for await (const chunk of aiService.generateStream({
  prompt: 'Generate a report',
  stream: true
})) {
  process.stdout.write(chunk.content);
  if (chunk.done) break;
}
```

### Prompt Templates

```typescript
// Use built-in template
const response = await aiService.generateFromTemplate(
  'invoice-extraction',
  {
    invoice_text: pdfContent
  },
  {
    temperature: 0.2,
    maxTokens: 2000
  }
);

// List available templates
const templates = aiService.getPromptLibrary().listTemplates();

// Find templates by domain
const financeTemplates = aiService.getPromptLibrary().findByDomain('finance');

// Register custom template
aiService.getPromptLibrary().registerTemplate({
  id: 'custom-template',
  name: 'My Custom Template',
  description: 'Does something specific',
  systemPrompt: 'You are an expert at...',
  userPromptTemplate: 'Process this: {{data}}',
  variables: ['data']
});
```

### Embeddings

```typescript
// Generate embeddings
const result = await aiService.generateEmbeddings({
  text: ['Invoice #123', 'Receipt for office supplies'],
  normalize: true
});

// Find similar texts
const similar = await aiService.findSimilar(
  'office supply invoice',
  allInvoiceTexts,
  5 // top 5 matches
);

similar.forEach(match => {
  console.log(`${match.text}: ${match.similarity}`);
});

// Batch encoding
const embeddings = await aiService.getEmbeddingService().batchEncode([
  'text 1',
  'text 2',
  'text 3'
]);
```

### Command Parsing

```typescript
// Parse natural language command
const result = await aiService.parseCommand(
  'Find all invoices from January'
);

if (result.success) {
  console.log('Intent:', result.command.intent);
  console.log('Parameters:', result.command.parameters);
  console.log('Confidence:', result.command.confidence);
}

// Get command suggestions
const suggestions = aiService.suggestCommands('find inv');
// Returns: ['Find all invoices from January', ...]
```

### Streaming Management

```typescript
const streamId = 'report-generation';

// Start managed stream with callbacks
const fullText = await aiService.startStream(
  streamId,
  {
    prompt: 'Generate comprehensive report',
    temperature: 0.7,
    maxTokens: 2000
  },
  {
    onChunk: (chunk) => {
      updateUI(chunk.content);
    },
    onComplete: (text) => {
      saveReport(text);
    },
    onError: (error) => {
      showError(error);
    }
  }
);

// Cancel stream if needed
aiService.cancelStream(streamId);

// Subscribe to stream events
const unsubscribe = aiService.getStreamHandler().subscribe(
  streamId,
  (event) => {
    console.log('Event:', event.type, event.data);
  }
);
```

## Configuration

```typescript
const aiService = getAIService({
  ollama: {
    baseUrl: 'http://localhost:11434',
    defaultModel: 'llama3.2:latest',
    timeout: 60000,
    keepAlive: 300
  },
  claude: {
    apiKey: process.env.CLAUDE_API_KEY,
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
    model: EmbeddingModel.SENTENCE_TRANSFORMERS,
    batchSize: 32,
    cacheEnabled: true
  }
});
```

## Built-in Prompt Templates

1. **invoice-extraction** - Extract structured data from invoices
2. **transaction-matching** - Match invoices to transactions
3. **command-intent** - Classify user command intent
4. **document-summary** - Summarize documents
5. **entity-extraction** - Extract named entities
6. **vendor-normalization** - Normalize vendor names
7. **file-organization** - Suggest file organization
8. **table-extraction** - Extract table data

## Architecture

```
AIService (Orchestration)
├── LLMRouter (Intelligent Routing)
│   ├── OllamaService (Local LLM)
│   └── ClaudeService (Cloud LLM)
├── PromptLibrary (Template Management)
├── EmbeddingService (Semantic Embeddings)
├── CommandParser (NL Understanding)
└── StreamHandler (Stream Management)
```

## Error Handling

```typescript
import { AIServiceError, AIErrorType } from './services/ai-service';

try {
  const response = await aiService.generate({
    prompt: 'Process this data'
  });
} catch (error) {
  if (error instanceof AIServiceError) {
    switch (error.type) {
      case AIErrorType.PROVIDER_UNAVAILABLE:
        // No LLM providers available
        break;
      case AIErrorType.RATE_LIMIT:
        // Rate limit hit, retry later
        break;
      case AIErrorType.AUTHENTICATION:
        // API key invalid
        break;
      case AIErrorType.TIMEOUT:
        // Request timed out
        break;
      default:
        // Other error
    }

    if (error.retryable) {
      // Can retry this operation
    }
  }
}
```

## Testing

```bash
# Run tests
npm test -- tests/services/ai-service

# Run specific test file
npm test -- tests/services/ai-service/AIService.test.ts

# Run with coverage
npm test -- --coverage tests/services/ai-service
```

## Performance Tips

1. **Use caching** - Enable response and embedding caching
2. **Prefer local** - Use Ollama for privacy and speed
3. **Batch operations** - Group multiple requests
4. **Stream when possible** - Better UX for long responses
5. **Tune temperature** - Lower for deterministic tasks

## Monitoring

```typescript
// Check service health
const health = await aiService.healthCheck();
console.log('Ollama:', health.ollama);
console.log('Claude:', health.claude);

// Get provider statistics
const stats = aiService.getProviderStats();
for (const [provider, status] of stats) {
  console.log(`${provider}:`, {
    available: status.available,
    latency: status.averageLatencyMs,
    requests: status.totalRequests,
    failures: status.consecutiveFailures
  });
}

// Get stream statistics
const streamStats = aiService.getStreamHandler().getStatistics();
console.log('Active streams:', streamStats.activeStreams);
console.log('Total chunks:', streamStats.totalChunks);
```

## Maintenance

```typescript
// Cleanup resources
await aiService.cleanup();

// Clear embedding cache
aiService.getEmbeddingService().clearCache();

// Reset service instance
resetAIService();
```

## Integration with Other Services

The AI service is designed to integrate with:

- **File Service** - Extract data from parsed files
- **Match Service** - Generate embeddings for semantic matching
- **Workflow Service** - Parse and execute natural language workflows
- **RAG Service** - Generate embeddings for vector storage

## Roadmap

- [ ] Fine-tuning support for domain-specific models
- [ ] Multi-modal support (images, audio)
- [ ] Advanced caching strategies
- [ ] Distributed inference
- [ ] Model quantization for faster local inference
- [ ] Plugin system for custom LLM providers

## License

MIT
