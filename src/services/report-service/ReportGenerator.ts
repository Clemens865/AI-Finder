/**
 * Report generation service for Excel and PDF reports
 */

import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';
import { Logger } from '../../shared/utils/logger';
import { ReportError } from '../../shared/utils/errors';
import { ReportOptions, ReportColumn } from '../../shared/types';

export class ReportGenerator {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('ReportGenerator');
  }

  /**
   * Generate report in specified format
   */
  async generateReport(options: ReportOptions): Promise<string> {
    this.logger.info('Generating report', {
      format: options.format,
      title: options.title,
      rowCount: options.data.length
    });

    await mkdir(dirname(options.output), { recursive: true });

    switch (options.format) {
      case 'excel':
        return this.generateExcelReport(options);

      case 'pdf':
        return this.generatePDFReport(options);

      case 'csv':
        return this.generateCSVReport(options);

      default:
        throw new ReportError(`Unsupported format: ${options.format}`, options.format);
    }
  }

  /**
   * Generate Excel report
   */
  private async generateExcelReport(options: ReportOptions): Promise<string> {
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Intelligent Finder';
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet(options.title);

      // Define columns
      const columns = options.columns || this.inferColumns(options.data);
      worksheet.columns = columns.map(col => ({
        header: col.header,
        key: col.key,
        width: col.width || 15
      }));

      // Style header row
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: options.styles?.headerBgColor || 'FF4472C4' }
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

      // Add data rows
      options.data.forEach((item, index) => {
        const row = worksheet.addRow(item);

        // Alternate row colors
        if (options.styles?.alternateRowColor && index % 2 === 1) {
          row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF2F2F2' }
          };
        }

        // Format cells based on type
        columns.forEach((col, colIndex) => {
          const cell = row.getCell(colIndex + 1);
          this.formatCell(cell, col, item[col.key]);
        });
      });

      // Auto-filter
      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: columns.length }
      };

      // Freeze header row
      worksheet.views = [{ state: 'frozen', ySplit: 1 }];

      await workbook.xlsx.writeFile(options.output);
      this.logger.info('Excel report generated', { output: options.output });

      return options.output;
    } catch (error) {
      this.logger.error('Failed to generate Excel report', error as Error);
      throw new ReportError(
        `Failed to generate Excel report: ${(error as Error).message}`,
        'excel'
      );
    }
  }

  /**
   * Generate PDF report
   */
  private async generatePDFReport(options: ReportOptions): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const stream = createWriteStream(options.output);

        doc.pipe(stream);

        // Title
        doc.fontSize(20).text(options.title, { align: 'center' });
        doc.moveDown();

        // Determine columns
        const columns = options.columns || this.inferColumns(options.data);
        const tableTop = doc.y;
        const columnWidth = (doc.page.width - 100) / columns.length;

        // Draw header
        doc.fontSize(10).fillColor('#000000');
        columns.forEach((col, i) => {
          doc.rect(50 + i * columnWidth, tableTop, columnWidth, 20)
             .fillAndStroke('#4472C4', '#000000');
          doc.fillColor('#FFFFFF')
             .text(col.header, 55 + i * columnWidth, tableTop + 5, {
               width: columnWidth - 10,
               align: 'left'
             });
        });

        // Draw data rows
        let y = tableTop + 25;
        doc.fillColor('#000000');

        options.data.forEach((item, rowIndex) => {
          // Check if new page needed
          if (y > doc.page.height - 100) {
            doc.addPage();
            y = 50;
          }

          // Alternate row colors
          if (rowIndex % 2 === 1) {
            doc.rect(50, y, doc.page.width - 100, 20).fill('#F2F2F2');
          }

          columns.forEach((col, colIndex) => {
            const value = this.formatValue(item[col.key], col);
            doc.fillColor('#000000')
               .text(String(value || ''), 55 + colIndex * columnWidth, y + 5, {
                 width: columnWidth - 10,
                 align: 'left'
               });
          });

          y += 25;
        });

        // Footer
        doc.fontSize(8)
           .text(
             `Generated on ${new Date().toLocaleString()}`,
             50,
             doc.page.height - 50,
             { align: 'center' }
           );

        doc.end();

        stream.on('finish', () => {
          this.logger.info('PDF report generated', { output: options.output });
          resolve(options.output);
        });

        stream.on('error', reject);
      } catch (error) {
        this.logger.error('Failed to generate PDF report', error as Error);
        reject(new ReportError(
          `Failed to generate PDF report: ${(error as Error).message}`,
          'pdf'
        ));
      }
    });
  }

  /**
   * Generate CSV report
   */
  private async generateCSVReport(options: ReportOptions): Promise<string> {
    try {
      const { stringify } = await import('csv-stringify/sync');

      const columns = options.columns || this.inferColumns(options.data);
      const headers = columns.map(col => col.header);
      const keys = columns.map(col => col.key);

      const records = options.data.map(item =>
        keys.map(key => this.formatValue(item[key], columns.find(c => c.key === key)))
      );

      const csv = stringify([headers, ...records]);

      const fs = await import('fs/promises');
      await fs.writeFile(options.output, csv);

      this.logger.info('CSV report generated', { output: options.output });
      return options.output;
    } catch (error) {
      this.logger.error('Failed to generate CSV report', error as Error);
      throw new ReportError(
        `Failed to generate CSV report: ${(error as Error).message}`,
        'csv'
      );
    }
  }

  /**
   * Infer columns from data
   */
  private inferColumns(data: any[]): ReportColumn[] {
    if (data.length === 0) return [];

    const firstItem = data[0];
    return Object.keys(firstItem).map(key => ({
      key,
      header: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
      type: this.inferType(firstItem[key])
    }));
  }

  /**
   * Infer data type
   */
  private inferType(value: any): 'string' | 'number' | 'date' | 'boolean' {
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (value instanceof Date) return 'date';
    if (typeof value === 'string' && !isNaN(Date.parse(value))) return 'date';
    return 'string';
  }

  /**
   * Format cell value
   */
  private formatCell(cell: ExcelJS.Cell, column: ReportColumn, value: any): void {
    switch (column.type) {
      case 'number':
        cell.numFmt = column.format || '#,##0.00';
        break;

      case 'date':
        if (value) {
          cell.value = new Date(value);
          cell.numFmt = column.format || 'yyyy-mm-dd';
        }
        break;

      case 'boolean':
        cell.value = value ? 'Yes' : 'No';
        break;

      default:
        cell.value = value;
    }
  }

  /**
   * Format value for display
   */
  private formatValue(value: any, column?: ReportColumn): string | number {
    if (value == null) return '';

    switch (column?.type) {
      case 'number':
        return typeof value === 'number' ? value : parseFloat(value);

      case 'date':
        const date = value instanceof Date ? value : new Date(value);
        return date.toLocaleDateString();

      case 'boolean':
        return value ? 'Yes' : 'No';

      default:
        return String(value);
    }
  }
}
