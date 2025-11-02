/**
 * Plain text file parser
 */

import { FileParser } from './ParserRegistry';
import { FileMetadata, ParsedContent, SupportedFileType } from '../../../shared/types';
import { ParserError } from '../../../shared/utils/errors';

export class TextParser implements FileParser {
  supportedExtensions = ['.txt', '.md', '.log'];

  async parse(content: Buffer, metadata: FileMetadata): Promise<ParsedContent> {
    try {
      const text = content.toString('utf-8');
      const lines = text.split('\n').length;
      const words = text.split(/\s+/).filter(w => w.length > 0).length;
      const chars = text.length;

      return {
        fileId: metadata.id,
        type: SupportedFileType.TEXT,
        content,
        metadata: {
          lines,
          words,
          characters: chars,
          encoding: 'utf-8'
        },
        extractedText: text
      };
    } catch (error) {
      throw new ParserError(
        `Failed to parse text file: ${(error as Error).message}`,
        SupportedFileType.TEXT,
        metadata.path
      );
    }
  }
}
