/**
 * Prompt Library
 *
 * Domain-specific prompt templates for various AI tasks in Intelligent Finder.
 * Supports variable substitution and few-shot examples.
 */

import { PromptTemplate, PromptContext } from '../types';

/**
 * PromptLibrary - Template management and rendering
 */
export class PromptLibrary {
  private templates: Map<string, PromptTemplate>;

  constructor() {
    this.templates = new Map();
    this.initializeTemplates();
  }

  /**
   * Initialize built-in templates
   */
  private initializeTemplates(): void {
    // Invoice extraction template
    this.registerTemplate({
      id: 'invoice-extraction',
      name: 'Invoice Data Extraction',
      description: 'Extract structured data from invoice text',
      systemPrompt: `You are an expert at extracting structured data from invoices.
Extract the following information accurately:
- Invoice number
- Date
- Vendor/supplier name
- Total amount
- Line items with descriptions and amounts
- Tax information

Return the data in valid JSON format. If information is missing, use null.`,
      userPromptTemplate: `Extract data from this invoice:

{{invoice_text}}`,
      variables: ['invoice_text'],
      examples: [
        {
          input: {
            invoice_text: 'Invoice #12345\nDate: 2024-01-15\nSupplier: Acme Corp\nTotal: $1,234.56'
          },
          output: JSON.stringify({
            invoice_number: '12345',
            date: '2024-01-15',
            vendor: 'Acme Corp',
            total: 1234.56,
            currency: 'USD'
          }, null, 2)
        }
      ],
      metadata: {
        domain: 'finance',
        useCase: 'invoice-processing',
        version: '1.0'
      }
    });

    // Transaction matching template
    this.registerTemplate({
      id: 'transaction-matching',
      name: 'Invoice-Transaction Matching',
      description: 'Match invoice to bank transaction with confidence score',
      systemPrompt: `You are an expert at matching invoices to bank transactions.
Analyze the invoice and transaction data to determine if they match.
Consider: amounts, dates (with tolerance), vendor names (fuzzy matching), descriptions.

Return a JSON object with:
- matched: boolean
- confidence: number (0-1)
- reasons: array of strings explaining the match/mismatch
- matched_fields: array of field names that matched`,
      userPromptTemplate: `Invoice:
{{invoice_data}}

Transaction:
{{transaction_data}}

Do these match?`,
      variables: ['invoice_data', 'transaction_data'],
      metadata: {
        domain: 'finance',
        useCase: 'matching',
        version: '1.0'
      }
    });

    // Command intent classification
    this.registerTemplate({
      id: 'command-intent',
      name: 'Command Intent Classification',
      description: 'Classify user command intent and extract parameters',
      systemPrompt: `You are an AI assistant that understands file management commands.
Classify the user's intent into one of: search, match, extract, organize, summarize, analyze.
Extract relevant parameters from the command.

Return JSON with:
- intent: string
- confidence: number (0-1)
- parameters: object with extracted values
- clarification: string (if needed)`,
      userPromptTemplate: `User command: {{command}}

Classify this command.`,
      variables: ['command'],
      examples: [
        {
          input: { command: 'Find all invoices from January' },
          output: JSON.stringify({
            intent: 'search',
            confidence: 0.95,
            parameters: {
              file_type: 'invoice',
              date_range: { month: 'January' }
            }
          }, null, 2)
        },
        {
          input: { command: 'Match these invoices to my bank statements' },
          output: JSON.stringify({
            intent: 'match',
            confidence: 0.98,
            parameters: {
              source: 'invoices',
              target: 'bank_statements'
            }
          }, null, 2)
        }
      ],
      metadata: {
        domain: 'commands',
        useCase: 'parsing',
        version: '1.0'
      }
    });

    // Document summarization
    this.registerTemplate({
      id: 'document-summary',
      name: 'Document Summarization',
      description: 'Create concise summary of document content',
      systemPrompt: `You are an expert at summarizing documents concisely.
Extract the key information and main points.
Keep summaries under 200 words unless specified otherwise.`,
      userPromptTemplate: `Summarize this document:

{{document_text}}

{{#if length}}Target length: {{length}} words{{/if}}`,
      variables: ['document_text', 'length'],
      metadata: {
        domain: 'content',
        useCase: 'summarization',
        version: '1.0'
      }
    });

    // Entity extraction
    this.registerTemplate({
      id: 'entity-extraction',
      name: 'Entity Extraction',
      description: 'Extract named entities from text',
      systemPrompt: `You are an expert at extracting named entities from text.
Identify: people, organizations, locations, dates, amounts, products.

Return JSON with entities categorized by type.`,
      userPromptTemplate: `Extract entities from:

{{text}}`,
      variables: ['text'],
      metadata: {
        domain: 'content',
        useCase: 'extraction',
        version: '1.0'
      }
    });

    // Vendor normalization
    this.registerTemplate({
      id: 'vendor-normalization',
      name: 'Vendor Name Normalization',
      description: 'Normalize vendor names for consistent matching',
      systemPrompt: `You are an expert at normalizing company and vendor names.
Remove legal suffixes (LLC, Inc, Corp, Ltd), standardize formatting, handle abbreviations.

Return the normalized name as a simple string.`,
      userPromptTemplate: `Normalize this vendor name: {{vendor_name}}`,
      variables: ['vendor_name'],
      examples: [
        {
          input: { vendor_name: 'ACME CORPORATION LLC' },
          output: 'Acme Corporation'
        },
        {
          input: { vendor_name: 'amazon web services inc' },
          output: 'Amazon Web Services'
        }
      ],
      metadata: {
        domain: 'finance',
        useCase: 'normalization',
        version: '1.0'
      }
    });

    // File organization suggestions
    this.registerTemplate({
      id: 'file-organization',
      name: 'File Organization Suggestions',
      description: 'Suggest intelligent file organization structure',
      systemPrompt: `You are an expert at organizing files intelligently.
Based on the file metadata, suggest a logical folder structure and naming convention.

Return JSON with:
- suggested_path: string
- suggested_name: string
- rationale: string`,
      userPromptTemplate: `Suggest organization for this file:

File: {{file_name}}
Type: {{file_type}}
Content summary: {{content_summary}}
Date: {{date}}`,
      variables: ['file_name', 'file_type', 'content_summary', 'date'],
      metadata: {
        domain: 'organization',
        useCase: 'file-management',
        version: '1.0'
      }
    });

    // Data extraction from tables
    this.registerTemplate({
      id: 'table-extraction',
      name: 'Table Data Extraction',
      description: 'Extract structured data from table text',
      systemPrompt: `You are an expert at extracting structured data from tables.
Parse the table and return data in JSON format with headers as keys.
Handle various table formats (markdown, plain text, etc.).`,
      userPromptTemplate: `Extract data from this table:

{{table_text}}`,
      variables: ['table_text'],
      metadata: {
        domain: 'content',
        useCase: 'extraction',
        version: '1.0'
      }
    });
  }

  /**
   * Register a new template
   */
  registerTemplate(template: PromptTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * Get template by ID
   */
  getTemplate(id: string): PromptTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * Render template with context
   */
  render(templateId: string, context: PromptContext): {
    systemPrompt: string;
    userPrompt: string;
  } {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Validate variables
    this.validateContext(template, context);

    // Render system prompt
    const systemPrompt = this.renderSystemPrompt(template, context);

    // Render user prompt
    const userPrompt = this.renderUserPrompt(template, context);

    return { systemPrompt, userPrompt };
  }

  /**
   * Render system prompt with examples
   */
  private renderSystemPrompt(template: PromptTemplate, context: PromptContext): string {
    let prompt = template.systemPrompt;

    // Add examples if requested and available
    if (context.includeExamples && template.examples && template.examples.length > 0) {
      const maxExamples = context.maxExamples || 3;
      const examples = template.examples.slice(0, maxExamples);

      prompt += '\n\nExamples:\n';
      examples.forEach((example, index) => {
        prompt += `\nExample ${index + 1}:\nInput: ${JSON.stringify(example.input, null, 2)}\nOutput: ${example.output}\n`;
      });
    }

    return prompt;
  }

  /**
   * Render user prompt with variable substitution
   */
  private renderUserPrompt(template: PromptTemplate, context: PromptContext): string {
    let prompt = template.userPromptTemplate;

    // Simple variable substitution
    for (const [key, value] of Object.entries(context.variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      prompt = prompt.replace(regex, String(value));
    }

    // Handle conditionals (simple implementation)
    prompt = prompt.replace(/{{#if (\w+)}}(.*?){{\/if}}/gs, (match, varName, content) => {
      return context.variables[varName] ? content : '';
    });

    return prompt;
  }

  /**
   * Validate context has all required variables
   */
  private validateContext(template: PromptTemplate, context: PromptContext): void {
    const missing = template.variables.filter(
      v => !(v in context.variables)
    );

    if (missing.length > 0) {
      throw new Error(
        `Missing required variables for template ${template.id}: ${missing.join(', ')}`
      );
    }
  }

  /**
   * List all templates
   */
  listTemplates(): PromptTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Find templates by domain
   */
  findByDomain(domain: string): PromptTemplate[] {
    return this.listTemplates().filter(
      t => t.metadata?.domain === domain
    );
  }

  /**
   * Find templates by use case
   */
  findByUseCase(useCase: string): PromptTemplate[] {
    return this.listTemplates().filter(
      t => t.metadata?.useCase === useCase
    );
  }
}
