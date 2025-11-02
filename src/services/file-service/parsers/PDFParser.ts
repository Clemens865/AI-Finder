/**
 * PDF file parser using pdf-parse
 */

import pdfParse from 'pdf-parse';
import { FileParser } from './ParserRegistry';
import { FileMetadata, ParsedContent, SupportedFileType } from '../../../shared/types';
import { ParserError } from '../../../shared/utils/errors';

export class PDFParser implements FileParser {
  supportedExtensions = ['.pdf'];

  async parse(content: Buffer, metadata: FileMetadata): Promise<ParsedContent> {
    try {
      const data = await pdfParse(content);

      return {
        fileId: metadata.id,
        type: SupportedFileType.PDF,
        content,
        metadata: {
          title: data.info?.Title || metadata.name,
          author: data.info?.Author,
          creator: data.info?.Creator,
          producer: data.info?.Producer,
          creationDate: data.info?.CreationDate,
          modDate: data.info?.ModDate,
          version: data.version
        },
        extractedText: data.text,
        pages: data.numpages
      };
    } catch (error) {
      throw new ParserError(
        `Failed to parse PDF: ${(error as Error).message}`,
        SupportedFileType.PDF,
        metadata.path
      );
    }
  }
}
