/**
 * JSON file parser
 */

import { FileParser } from './ParserRegistry';
import { FileMetadata, ParsedContent, SupportedFileType } from '../../../shared/types';
import { ParserError } from '../../../shared/utils/errors';

export class JSONParser implements FileParser {
  supportedExtensions = ['.json'];

  async parse(content: Buffer, metadata: FileMetadata): Promise<ParsedContent> {
    try {
      const text = content.toString('utf-8');
      const data = JSON.parse(text);

      // Stringify for text extraction
      const extractedText = JSON.stringify(data, null, 2);

      return {
        fileId: metadata.id,
        type: SupportedFileType.JSON,
        content,
        metadata: {
          isArray: Array.isArray(data),
          keys: typeof data === 'object' && !Array.isArray(data) ? Object.keys(data) : [],
          size: JSON.stringify(data).length
        },
        extractedText
      };
    } catch (error) {
      throw new ParserError(
        `Failed to parse JSON file: ${(error as Error).message}`,
        SupportedFileType.JSON,
        metadata.path
      );
    }
  }
}
