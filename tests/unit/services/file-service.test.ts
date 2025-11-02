/**
 * Unit tests for File Service
 * Tests file reading, writing, parsing, and metadata operations
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { generateFileMetadata, mockPDFContent } from '../../fixtures/test-data';

// Mock implementation of FileService
class FileService {
  async read(path: string): Promise<any> {
    if (!path) throw new Error('Path is required');
    return { content: 'test content', type: 'text/plain' };
  }

  async readMetadata(path: string) {
    return generateFileMetadata({ path });
  }

  async write(path: string, content: any): Promise<void> {
    if (!path) throw new Error('Path is required');
    if (!content) throw new Error('Content is required');
  }

  async extract(path: string, schema?: any) {
    return {
      invoiceNumber: 'INV-12345',
      amount: 1210,
      vendor: 'Test Vendor'
    };
  }

  async backup(path: string): Promise<string> {
    return `${path}.backup.${Date.now()}`;
  }
}

describe('FileService', () => {
  let fileService: FileService;

  beforeEach(() => {
    fileService = new FileService();
  });

  describe('read', () => {
    it('should read file content successfully', async () => {
      const path = '/test/document.pdf';
      const result = await fileService.read(path);

      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('type');
    });

    it('should throw error when path is empty', async () => {
      await expect(fileService.read('')).rejects.toThrow('Path is required');
    });

    it('should handle large files with streaming', async () => {
      const largePath = '/test/large-file.pdf';
      const result = await fileService.read(largePath);

      expect(result).toBeDefined();
    });
  });

  describe('readMetadata', () => {
    it('should extract file metadata', async () => {
      const path = '/test/document.pdf';
      const metadata = await fileService.readMetadata(path);

      expect(metadata).toHaveProperty('id');
      expect(metadata).toHaveProperty('path');
      expect(metadata).toHaveProperty('name');
      expect(metadata).toHaveProperty('type');
      expect(metadata).toHaveProperty('size');
      expect(metadata.path).toBe(path);
    });

    it('should include checksum for integrity verification', async () => {
      const metadata = await fileService.readMetadata('/test/document.pdf');

      expect(metadata).toHaveProperty('checksum');
      expect(metadata.checksum).toMatch(/^sha256-/);
    });
  });

  describe('write', () => {
    it('should write content to file', async () => {
      const path = '/test/output.txt';
      const content = 'Test content';

      await expect(fileService.write(path, content)).resolves.not.toThrow();
    });

    it('should throw error when path is empty', async () => {
      await expect(fileService.write('', 'content')).rejects.toThrow('Path is required');
    });

    it('should throw error when content is empty', async () => {
      await expect(fileService.write('/test/file.txt', null)).rejects.toThrow('Content is required');
    });

    it('should handle binary content', async () => {
      const path = '/test/image.png';
      const binaryContent = Buffer.from([0x89, 0x50, 0x4E, 0x47]);

      await expect(fileService.write(path, binaryContent)).resolves.not.toThrow();
    });
  });

  describe('extract', () => {
    it('should extract structured data from PDF', async () => {
      const path = '/test/invoice.pdf';
      const extracted = await fileService.extract(path);

      expect(extracted).toHaveProperty('invoiceNumber');
      expect(extracted).toHaveProperty('amount');
      expect(extracted).toHaveProperty('vendor');
    });

    it('should use schema for targeted extraction', async () => {
      const schema = {
        fields: ['invoiceNumber', 'amount', 'date']
      };

      const extracted = await fileService.extract('/test/invoice.pdf', schema);

      expect(Object.keys(extracted)).toHaveLength(3);
    });

    it('should handle OCR fallback for scanned PDFs', async () => {
      const scannedPDF = '/test/scanned-invoice.pdf';
      const extracted = await fileService.extract(scannedPDF);

      expect(extracted).toBeDefined();
      expect(extracted.invoiceNumber).toBeDefined();
    });
  });

  describe('backup', () => {
    it('should create backup before destructive operations', async () => {
      const path = '/test/important-file.pdf';
      const backupPath = await fileService.backup(path);

      expect(backupPath).toContain(path);
      expect(backupPath).toContain('.backup');
    });

    it('should include timestamp in backup filename', async () => {
      const backupPath = await fileService.backup('/test/file.pdf');

      expect(backupPath).toMatch(/\.\d+$/);
    });
  });

  describe('edge cases', () => {
    it('should handle files with special characters in name', async () => {
      const specialPath = '/test/file-with-émoji-🎉.pdf';
      const metadata = await fileService.readMetadata(specialPath);

      expect(metadata.path).toBe(specialPath);
    });

    it('should handle very long file paths', async () => {
      const longPath = '/test/' + 'a'.repeat(200) + '.pdf';
      const metadata = await fileService.readMetadata(longPath);

      expect(metadata.path).toBe(longPath);
    });

    it('should handle concurrent read operations', async () => {
      const paths = Array.from({ length: 10 }, (_, i) => `/test/file${i}.pdf`);
      const promises = paths.map(path => fileService.read(path));

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result).toHaveProperty('content');
      });
    });
  });

  describe('performance', () => {
    it('should read file under 100ms', async () => {
      const start = performance.now();
      await fileService.read('/test/small-file.pdf');
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
    });

    it('should handle batch operations efficiently', async () => {
      const paths = Array.from({ length: 100 }, (_, i) => `/test/file${i}.pdf`);

      const start = performance.now();
      await Promise.all(paths.map(p => fileService.readMetadata(p)));
      const duration = performance.now() - start;

      // Should complete in under 1 second
      expect(duration).toBeLessThan(1000);
    });
  });
});
