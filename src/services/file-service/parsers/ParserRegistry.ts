/**
 * Parser registry for managing file type parsers
 */

import { FileMetadata, ParsedContent, SupportedFileType } from '../../../shared/types';
import { ParserError } from '../../../shared/utils/errors';
import { PDFParser } from './PDFParser';
import { ExcelParser } from './ExcelParser';
import { CSVParser } from './CSVParser';
import { ImageParser } from './ImageParser';
import { TextParser } from './TextParser';
import { JSONParser } from './JSONParser';

export interface FileParser {
  supportedExtensions: string[];
  parse(content: Buffer, metadata: FileMetadata): Promise<ParsedContent>;
}

export class ParserRegistry {
  private parsers: Map<string, FileParser>;

  constructor() {
    this.parsers = new Map();
    this.registerDefaultParsers();
  }

  private registerDefaultParsers(): void {
    this.register(new PDFParser());
    this.register(new ExcelParser());
    this.register(new CSVParser());
    this.register(new ImageParser());
    this.register(new TextParser());
    this.register(new JSONParser());
  }

  register(parser: FileParser): void {
    for (const ext of parser.supportedExtensions) {
      this.parsers.set(ext.toLowerCase(), parser);
    }
  }

  getParser(extension: string): FileParser | undefined {
    return this.parsers.get(extension.toLowerCase());
  }

  getSupportedExtensions(): string[] {
    return Array.from(this.parsers.keys());
  }
}
