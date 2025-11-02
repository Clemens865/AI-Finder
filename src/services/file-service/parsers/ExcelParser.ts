/**
 * Excel file parser using exceljs
 */

import ExcelJS from 'exceljs';
import { FileParser } from './ParserRegistry';
import { FileMetadata, ParsedContent, SupportedFileType } from '../../../shared/types';
import { ParserError } from '../../../shared/utils/errors';

export class ExcelParser implements FileParser {
  supportedExtensions = ['.xlsx', '.xls'];

  async parse(content: Buffer, metadata: FileMetadata): Promise<ParsedContent> {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(content);

      const sheets: string[] = [];
      let extractedText = '';

      workbook.eachSheet((worksheet, sheetId) => {
        sheets.push(worksheet.name);

        worksheet.eachRow((row, rowNumber) => {
          const rowData: any[] = [];
          row.eachCell((cell, colNumber) => {
            rowData.push(cell.value);
          });
          extractedText += rowData.join('\t') + '\n';
        });
      });

      return {
        fileId: metadata.id,
        type: SupportedFileType.EXCEL,
        content,
        metadata: {
          creator: workbook.creator,
          lastModifiedBy: workbook.lastModifiedBy,
          created: workbook.created,
          modified: workbook.modified,
          sheetCount: sheets.length
        },
        extractedText: extractedText.trim(),
        sheets
      };
    } catch (error) {
      throw new ParserError(
        `Failed to parse Excel file: ${(error as Error).message}`,
        SupportedFileType.EXCEL,
        metadata.path
      );
    }
  }
}
