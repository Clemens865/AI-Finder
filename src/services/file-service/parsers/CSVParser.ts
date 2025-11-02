/**
 * CSV file parser using csv-parse
 */

import { parse } from 'csv-parse/sync';
import { FileParser } from './ParserRegistry';
import { FileMetadata, ParsedContent, SupportedFileType } from '../../../shared/types';
import { ParserError } from '../../../shared/utils/errors';

export class CSVParser implements FileParser {
  supportedExtensions = ['.csv'];

  async parse(content: Buffer, metadata: FileMetadata): Promise<ParsedContent> {
    try {
      const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });

      const extractedText = records
        .map((record: any) => Object.values(record).join(' '))
        .join('\n');

      return {
        fileId: metadata.id,
        type: SupportedFileType.CSV,
        content,
        metadata: {
          rowCount: records.length,
          columns: records.length > 0 ? Object.keys(records[0]) : [],
          encoding: metadata.encoding || 'utf-8'
        },
        extractedText
      };
    } catch (error) {
      throw new ParserError(
        `Failed to parse CSV file: ${(error as Error).message}`,
        SupportedFileType.CSV,
        metadata.path
      );
    }
  }
}
