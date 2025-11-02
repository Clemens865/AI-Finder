/**
 * Command Parser
 *
 * Natural language command parser with intent classification
 * for intelligent file operations.
 */

import {
  CommandIntent,
  ParsedCommand,
  CommandParseResult,
  LLMRequest,
  LLMResponse
} from './types';

/**
 * Intent patterns for quick classification
 */
const INTENT_PATTERNS: Record<CommandIntent, RegExp[]> = {
  [CommandIntent.SEARCH]: [
    /\b(find|search|look for|locate|show me|list)\b/i,
    /\b(where|what|which)\b.*\b(files?|documents?|invoices?)\b/i
  ],
  [CommandIntent.MATCH]: [
    /\b(match|pair|link|connect|associate)\b/i,
    /\b(invoice|transaction|statement).*\b(to|with|against)\b/i
  ],
  [CommandIntent.EXTRACT]: [
    /\b(extract|get|pull|retrieve)\b.*\b(data|information|content)\b/i,
    /\b(parse|read)\b/i
  ],
  [CommandIntent.ORGANIZE]: [
    /\b(organize|sort|arrange|structure|categorize|group)\b/i,
    /\b(folder|directory|rename|move)\b/i
  ],
  [CommandIntent.SUMMARIZE]: [
    /\b(summarize|summary|overview|brief)\b/i,
    /\b(what is|tell me about)\b/i
  ],
  [CommandIntent.ANALYZE]: [
    /\b(analyze|analysis|examine|inspect|check)\b/i,
    /\b(compare|evaluate)\b/i
  ],
  [CommandIntent.UNKNOWN]: []
};

/**
 * Parameter extraction patterns
 */
interface ParameterPattern {
  name: string;
  pattern: RegExp;
  extractor: (match: RegExpMatchArray) => any;
}

const PARAMETER_PATTERNS: ParameterPattern[] = [
  {
    name: 'file_type',
    pattern: /\b(invoice|pdf|excel|csv|image|document|transaction|statement)s?\b/i,
    extractor: (match) => match[1].toLowerCase()
  },
  {
    name: 'date_range',
    pattern: /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i,
    extractor: (match) => ({ month: match[1] })
  },
  {
    name: 'date_range',
    pattern: /\b(last|past)\s+(\d+)\s+(day|week|month|year)s?\b/i,
    extractor: (match) => ({ relative: `${match[1]} ${match[2]} ${match[3]}s` })
  },
  {
    name: 'vendor',
    pattern: /\bfrom\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/,
    extractor: (match) => match[1]
  },
  {
    name: 'amount',
    pattern: /\$\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/,
    extractor: (match) => parseFloat(match[1].replace(/,/g, ''))
  },
  {
    name: 'count',
    pattern: /\b(\d+)\s+(file|document|invoice|item)s?\b/i,
    extractor: (match) => parseInt(match[1], 10)
  },
  {
    name: 'folder',
    pattern: /\b(?:in|to|from)\s+(?:the\s+)?([a-zA-Z0-9_\-\/]+)\s+(?:folder|directory)\b/i,
    extractor: (match) => match[1]
  }
];

/**
 * CommandParser - Parse natural language commands
 */
export class CommandParser {
  private llmService: any; // Reference to LLM service for complex parsing

  constructor(llmService?: any) {
    this.llmService = llmService;
  }

  /**
   * Parse a natural language command
   */
  async parse(command: string): Promise<CommandParseResult> {
    try {
      // Quick pattern-based classification
      const quickParse = this.quickParse(command);

      // If high confidence, return quick parse
      if (quickParse.confidence >= 0.8) {
        return {
          success: true,
          command: quickParse
        };
      }

      // Use LLM for complex commands
      if (this.llmService) {
        const llmParse = await this.llmParse(command);
        return {
          success: true,
          command: llmParse
        };
      }

      // Fallback to quick parse
      if (quickParse.confidence >= 0.5) {
        return {
          success: true,
          command: quickParse,
          suggestions: ['Try being more specific for better accuracy']
        };
      }

      return {
        success: false,
        error: 'Unable to understand command',
        suggestions: [
          'Try commands like: "Find all invoices from January"',
          'Or: "Match these invoices to bank statements"',
          'Or: "Organize files by date"'
        ]
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to parse command: ${(error as Error).message}`
      };
    }
  }

  /**
   * Quick pattern-based parsing
   */
  private quickParse(command: string): ParsedCommand {
    // Classify intent
    const intent = this.classifyIntent(command);
    const confidence = this.calculateIntentConfidence(command, intent);

    // Extract parameters
    const parameters = this.extractParameters(command);

    return {
      intent,
      confidence,
      parameters,
      originalText: command,
      timestamp: new Date()
    };
  }

  /**
   * LLM-based parsing for complex commands
   */
  private async llmParse(command: string): Promise<ParsedCommand> {
    const request: LLMRequest = {
      prompt: `Parse this file management command and extract intent and parameters:

Command: "${command}"

Return JSON with:
{
  "intent": "search|match|extract|organize|summarize|analyze",
  "confidence": 0.0-1.0,
  "parameters": {...},
  "clarification": "optional question if ambiguous"
}`,
      systemPrompt: `You are a command parser for a file management system.
Valid intents: search, match, extract, organize, summarize, analyze.
Extract all relevant parameters accurately.`,
      temperature: 0.3,
      maxTokens: 500
    };

    const response: LLMResponse = await this.llmService.generate(request);

    try {
      // Parse JSON from response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        intent: this.mapIntent(parsed.intent),
        confidence: parsed.confidence || 0.7,
        parameters: parsed.parameters || {},
        originalText: command,
        timestamp: new Date()
      };

    } catch (error) {
      // Fallback to quick parse
      return this.quickParse(command);
    }
  }

  /**
   * Classify command intent
   */
  private classifyIntent(command: string): CommandIntent {
    let bestIntent = CommandIntent.UNKNOWN;
    let maxMatches = 0;

    for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
      const matches = patterns.filter(pattern => pattern.test(command)).length;
      if (matches > maxMatches) {
        maxMatches = matches;
        bestIntent = intent as CommandIntent;
      }
    }

    return bestIntent;
  }

  /**
   * Calculate confidence score for intent
   */
  private calculateIntentConfidence(command: string, intent: CommandIntent): number {
    if (intent === CommandIntent.UNKNOWN) return 0.1;

    const patterns = INTENT_PATTERNS[intent];
    const matches = patterns.filter(pattern => pattern.test(command)).length;

    // Base confidence on pattern matches
    const baseConfidence = Math.min(matches / 2, 0.9);

    // Boost if command is clear and specific
    const hasFileType = /\b(invoice|pdf|excel|csv|document|file)\b/i.test(command);
    const hasAction = /\b(find|match|extract|organize|summarize|analyze)\b/i.test(command);

    let confidence = baseConfidence;
    if (hasFileType) confidence += 0.1;
    if (hasAction) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }

  /**
   * Extract parameters from command
   */
  private extractParameters(command: string): Record<string, any> {
    const parameters: Record<string, any> = {};

    for (const pattern of PARAMETER_PATTERNS) {
      const match = command.match(pattern.pattern);
      if (match) {
        const value = pattern.extractor(match);

        // Merge with existing if same parameter
        if (parameters[pattern.name]) {
          if (typeof value === 'object' && typeof parameters[pattern.name] === 'object') {
            parameters[pattern.name] = { ...parameters[pattern.name], ...value };
          } else {
            // Keep first match
            continue;
          }
        } else {
          parameters[pattern.name] = value;
        }
      }
    }

    return parameters;
  }

  /**
   * Map string intent to enum
   */
  private mapIntent(intentStr: string): CommandIntent {
    const normalized = intentStr.toLowerCase();
    switch (normalized) {
      case 'search':
        return CommandIntent.SEARCH;
      case 'match':
        return CommandIntent.MATCH;
      case 'extract':
        return CommandIntent.EXTRACT;
      case 'organize':
        return CommandIntent.ORGANIZE;
      case 'summarize':
        return CommandIntent.SUMMARIZE;
      case 'analyze':
        return CommandIntent.ANALYZE;
      default:
        return CommandIntent.UNKNOWN;
    }
  }

  /**
   * Validate parsed command
   */
  validateCommand(parsed: ParsedCommand): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check intent
    if (parsed.intent === CommandIntent.UNKNOWN) {
      issues.push('Intent is unknown or ambiguous');
    }

    // Check confidence
    if (parsed.confidence < 0.5) {
      issues.push('Low confidence in parsing accuracy');
    }

    // Check parameters for specific intents
    switch (parsed.intent) {
      case CommandIntent.SEARCH:
        if (!parsed.parameters.file_type && !parsed.parameters.date_range) {
          issues.push('Search requires file type or date range');
        }
        break;
      case CommandIntent.MATCH:
        if (!parsed.parameters.source || !parsed.parameters.target) {
          issues.push('Match requires source and target specification');
        }
        break;
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Generate command suggestions based on partial input
   */
  suggestCommands(partial: string): string[] {
    const suggestions: string[] = [];

    const lower = partial.toLowerCase();

    if (lower.includes('find') || lower.includes('search')) {
      suggestions.push('Find all invoices from January');
      suggestions.push('Search for PDFs containing "tax"');
      suggestions.push('Find files larger than 1MB');
    }

    if (lower.includes('match')) {
      suggestions.push('Match invoices to bank statements');
      suggestions.push('Match transactions to receipts');
    }

    if (lower.includes('organize')) {
      suggestions.push('Organize files by date');
      suggestions.push('Organize invoices into folders by vendor');
    }

    if (lower.includes('extract')) {
      suggestions.push('Extract data from invoices');
      suggestions.push('Extract amounts from all receipts');
    }

    // General suggestions if no specific keyword
    if (suggestions.length === 0) {
      suggestions.push('Find all invoices from last month');
      suggestions.push('Match invoices to transactions');
      suggestions.push('Organize files by type');
      suggestions.push('Extract data from selected files');
      suggestions.push('Summarize this document');
    }

    return suggestions.slice(0, 5);
  }
}
