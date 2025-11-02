/**
 * Image file parser using sharp and tesseract.js for OCR
 */

import sharp from 'sharp';
import { createWorker } from 'tesseract.js';
import { FileParser } from './ParserRegistry';
import { FileMetadata, ParsedContent, SupportedFileType } from '../../../shared/types';
import { ParserError } from '../../../shared/utils/errors';

export class ImageParser implements FileParser {
  supportedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff'];

  async parse(content: Buffer, metadata: FileMetadata): Promise<ParsedContent> {
    try {
      // Get image metadata using sharp
      const image = sharp(content);
      const imageMetadata = await image.metadata();

      // Perform OCR to extract text
      let extractedText = '';
      try {
        const worker = await createWorker();
        await worker.loadLanguage('eng');
        await worker.initialize('eng');
        const { data } = await worker.recognize(content);
        extractedText = data.text;
        await worker.terminate();
      } catch (ocrError) {
        // OCR is optional, continue without it
        console.warn('OCR failed:', ocrError);
      }

      return {
        fileId: metadata.id,
        type: SupportedFileType.IMAGE,
        content,
        metadata: {
          format: imageMetadata.format,
          space: imageMetadata.space,
          channels: imageMetadata.channels,
          depth: imageMetadata.depth,
          density: imageMetadata.density,
          hasAlpha: imageMetadata.hasAlpha,
          orientation: imageMetadata.orientation
        },
        extractedText: extractedText.trim(),
        imageData: {
          width: imageMetadata.width || 0,
          height: imageMetadata.height || 0,
          format: imageMetadata.format || 'unknown'
        }
      };
    } catch (error) {
      throw new ParserError(
        `Failed to parse image: ${(error as Error).message}`,
        SupportedFileType.IMAGE,
        metadata.path
      );
    }
  }
}
