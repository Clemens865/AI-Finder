/**
 * Unit tests for FileService
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { FileService } from '../../../../src/services/file-service';
import { DatabaseManager } from '../../../../src/database/Database';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('FileService', () => {
  let fileService: FileService;
  let db: DatabaseManager;
  let testDir: string;

  beforeEach(async () => {
    // Create temporary directory for tests
    testDir = await mkdtemp(join(tmpdir(), 'file-service-test-'));

    // Initialize database
    db = new DatabaseManager(':memory:');

    // Initialize file service
    fileService = new FileService(db, {
      backupRoot: join(testDir, '.backups'),
      enableBackup: true,
      enableHistory: true
    });
  });

  afterEach(async () => {
    // Cleanup
    await rm(testDir, { recursive: true, force: true });
  });

  describe('read operations', () => {
    it('should read a file successfully', async () => {
      const testFile = join(testDir, 'test.txt');
      const testContent = 'Hello, World!';
      await writeFile(testFile, testContent);

      const result = await fileService.read(testFile);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.content.toString()).toBe(testContent);
      expect(result.data?.metadata.name).toBe('test.txt');
    });

    it('should fail to read non-existent file', async () => {
      const result = await fileService.read(join(testDir, 'nonexistent.txt'));

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should read metadata only', async () => {
      const testFile = join(testDir, 'test.txt');
      await writeFile(testFile, 'content');

      const result = await fileService.readMetadata(testFile);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.name).toBe('test.txt');
    });
  });

  describe('write operations', () => {
    it('should write a file successfully', async () => {
      const testFile = join(testDir, 'new.txt');
      const content = 'New content';

      const result = await fileService.write(testFile, content);

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('new.txt');
    });

    it('should create backup when overwriting existing file', async () => {
      const testFile = join(testDir, 'existing.txt');
      await writeFile(testFile, 'original content');

      const result = await fileService.write(testFile, 'new content');

      expect(result.success).toBe(true);

      // Check backups exist
      const stats = fileService.getStatistics();
      expect(stats.backups.totalBackups).toBeGreaterThan(0);
    });
  });

  describe('batch operations', () => {
    it('should read multiple files in batch', async () => {
      const files = ['file1.txt', 'file2.txt', 'file3.txt'];
      const paths: string[] = [];

      for (const file of files) {
        const path = join(testDir, file);
        await writeFile(path, `Content of ${file}`);
        paths.push(path);
      }

      const result = await fileService.readBatch(paths);

      expect(result.success).toBe(true);
      expect(result.successfulOperations).toBe(3);
      expect(result.failedOperations).toBe(0);
    });

    it('should handle partial failures in batch', async () => {
      const paths = [
        join(testDir, 'existing.txt'),
        join(testDir, 'nonexistent.txt')
      ];

      await writeFile(paths[0], 'content');

      const result = await fileService.readBatch(paths);

      expect(result.totalOperations).toBe(2);
      expect(result.successfulOperations).toBe(1);
      expect(result.failedOperations).toBe(1);
    });
  });

  describe('copy operations', () => {
    it('should copy a file successfully', async () => {
      const source = join(testDir, 'source.txt');
      const dest = join(testDir, 'dest.txt');
      await writeFile(source, 'content');

      const result = await fileService.copy(source, dest);

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('dest.txt');
    });
  });

  describe('move operations', () => {
    it('should move a file successfully', async () => {
      const source = join(testDir, 'source.txt');
      const dest = join(testDir, 'dest.txt');
      await writeFile(source, 'content');

      const result = await fileService.move(source, dest);

      expect(result.success).toBe(true);
      expect(result.data?.path).toBe(dest);
    });

    it('should support rename', async () => {
      const oldPath = join(testDir, 'old.txt');
      const newPath = join(testDir, 'new.txt');
      await writeFile(oldPath, 'content');

      const result = await fileService.rename(oldPath, newPath);

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('new.txt');
    });
  });

  describe('delete operations', () => {
    it('should delete a file with backup', async () => {
      const testFile = join(testDir, 'delete-me.txt');
      await writeFile(testFile, 'content');

      const result = await fileService.delete(testFile);

      expect(result.success).toBe(true);

      // Verify backup was created
      const stats = fileService.getStatistics();
      expect(stats.backups.totalBackups).toBeGreaterThan(0);
    });
  });

  describe('undo/redo operations', () => {
    it('should undo a write operation', async () => {
      const testFile = join(testDir, 'undo-test.txt');

      // Write file
      await fileService.write(testFile, 'content');

      // Undo
      const undone = await fileService.undo();
      expect(undone).toBe(true);

      // Check history
      expect(fileService.canRedo()).toBe(true);
    });

    it('should redo an undone operation', async () => {
      const testFile = join(testDir, 'redo-test.txt');

      // Write and undo
      await fileService.write(testFile, 'content');
      await fileService.undo();

      // Redo
      const redone = await fileService.redo();
      expect(redone).toBe(true);
    });
  });

  describe('backup and restore', () => {
    it('should create and restore backup', async () => {
      const testFile = join(testDir, 'backup-test.txt');
      const originalContent = 'original content';
      await writeFile(testFile, originalContent);

      // Create backup
      const backupResult = await fileService.backup(testFile);
      expect(backupResult.success).toBe(true);

      // Modify file
      await writeFile(testFile, 'modified content');

      // Restore backup
      const restoreResult = await fileService.restore(backupResult.data!.backupId);
      expect(restoreResult.success).toBe(true);
    });
  });

  describe('search operations', () => {
    it('should search files by extension', async () => {
      // Create test files
      await writeFile(join(testDir, 'test1.txt'), 'content');
      await writeFile(join(testDir, 'test2.txt'), 'content');
      await writeFile(join(testDir, 'test.json'), '{}');

      // Trigger metadata collection
      await fileService.read(join(testDir, 'test1.txt'));
      await fileService.read(join(testDir, 'test2.txt'));
      await fileService.read(join(testDir, 'test.json'));

      const results = fileService.searchFiles({ extension: '.txt' });
      expect(results.length).toBe(2);
    });

    it('should search files by size range', async () => {
      const smallFile = join(testDir, 'small.txt');
      const largeFile = join(testDir, 'large.txt');

      await writeFile(smallFile, 'small');
      await writeFile(largeFile, 'a'.repeat(1000));

      // Trigger metadata collection
      await fileService.read(smallFile);
      await fileService.read(largeFile);

      const results = fileService.searchFiles({
        minSize: 100
      });

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('statistics', () => {
    it('should provide service statistics', () => {
      const stats = fileService.getStatistics();

      expect(stats.metadata).toBeDefined();
      expect(stats.backups).toBeDefined();
      expect(stats.operations).toBeDefined();
      expect(stats.parsers).toBeDefined();
      expect(stats.parsers.supportedExtensions).toContain('.pdf');
    });
  });
});
