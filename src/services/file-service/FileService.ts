/**
 * Core file service for Intelligent Finder
 * Handles all file operations with comprehensive error handling, backup, and sandboxing
 */

import { readFile, writeFile, stat, copyFile, unlink, mkdir, rename } from 'fs/promises';
import { dirname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../../shared/utils/logger';
import { FileServiceError } from '../../shared/utils/errors';
import {
  FileMetadata,
  FileOperationResult,
  FileOperationType,
  ParsedContent,
  UndoableOperation
} from '../../shared/types';
import { ParserRegistry } from './parsers/ParserRegistry';
import { DatabaseManager } from '../../database/Database';
import { FileMetadataManager } from './managers/FileMetadata';
import { BackupManager, BackupOptions } from './managers/BackupManager';
import { OperationHistory } from './operations/OperationHistory';
import { BatchOperations, BatchOperation, BatchResult } from './operations/BatchOperations';

export interface FileServiceOptions {
  enableBackup?: boolean;
  enableHistory?: boolean;
  backupRoot?: string;
  maxConcurrency?: number;
}

export class FileService {
  private logger: Logger;
  private parserRegistry: ParserRegistry;
  private db: DatabaseManager;
  private metadataManager: FileMetadataManager;
  private backupManager: BackupManager;
  private operationHistory: OperationHistory;
  private batchOps: BatchOperations;
  private options: Required<FileServiceOptions>;

  constructor(db: DatabaseManager, options: FileServiceOptions = {}) {
    this.logger = new Logger('FileService');
    this.db = db;
    this.parserRegistry = new ParserRegistry();

    this.options = {
      enableBackup: options.enableBackup ?? true,
      enableHistory: options.enableHistory ?? true,
      backupRoot: options.backupRoot || './.backups',
      maxConcurrency: options.maxConcurrency || 10
    };

    this.metadataManager = new FileMetadataManager(db);
    this.backupManager = new BackupManager(db, this.options.backupRoot);
    this.operationHistory = new OperationHistory(db);
    this.batchOps = new BatchOperations(this.options.maxConcurrency);

    this.logger.info('FileService initialized', this.options);
  }

  /**
   * Read file and return metadata with content
   */
  async read(path: string): Promise<FileOperationResult<{ metadata: FileMetadata; content: Buffer }>> {
    const startTime = Date.now();
    const operationId = uuidv4();

    try {
      this.logger.info('Reading file', { path, operationId });

      const content = await readFile(path);
      const metadata = await this.metadataManager.getMetadata(path);
      await this.metadataManager.updateChecksum(metadata, content);

      const duration = Date.now() - startTime;
      this.logger.info('File read successfully', { path, size: content.length, duration });

      return {
        success: true,
        operationId,
        data: { metadata, content },
        timestamp: new Date(),
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Failed to read file', error as Error, { path, operationId });

      return {
        success: false,
        operationId,
        error: (error as Error).message,
        timestamp: new Date(),
        duration
      };
    }
  }

  /**
   * Read multiple files in batch
   */
  async readBatch(paths: string[]): Promise<BatchResult> {
    const operations = this.batchOps.createReadBatch(paths);
    return this.batchOps.executeBatch(operations);
  }

  /**
   * Get file metadata only
   */
  async readMetadata(path: string): Promise<FileOperationResult<FileMetadata>> {
    const startTime = Date.now();
    const operationId = uuidv4();

    try {
      const metadata = await this.metadataManager.getMetadata(path);
      const duration = Date.now() - startTime;

      return {
        success: true,
        operationId,
        data: metadata,
        timestamp: new Date(),
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        success: false,
        operationId,
        error: (error as Error).message,
        timestamp: new Date(),
        duration
      };
    }
  }

  /**
   * Write content to file with backup
   */
  async write(path: string, content: Buffer | string, options?: BackupOptions): Promise<FileOperationResult<FileMetadata>> {
    const startTime = Date.now();
    const operationId = uuidv4();

    try {
      this.logger.info('Writing file', { path, operationId });

      // Create backup if file exists and backup is enabled
      let backupId: string | undefined;
      if (this.options.enableBackup) {
        try {
          await stat(path);
          const backup = await this.backupManager.createBackup(path, options);
          backupId = backup.id;
          this.logger.debug('Backup created', { path, backupId });
        } catch {
          // File doesn't exist, no backup needed
        }
      }

      // Ensure directory exists
      await mkdir(dirname(path), { recursive: true });

      // Write file
      await writeFile(path, content);

      // Update metadata
      const metadata = await this.metadataManager.getMetadata(path, true);
      const contentBuffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
      await this.metadataManager.updateChecksum(metadata, contentBuffer);

      // Record operation for undo
      if (this.options.enableHistory) {
        const operation: UndoableOperation = {
          id: operationId,
          type: FileOperationType.WRITE,
          execute: async () => {
            await writeFile(path, content);
          },
          undo: async () => {
            if (backupId) {
              await this.backupManager.restoreBackup({ backupId, overwrite: true });
            } else {
              await unlink(path);
            }
          },
          timestamp: new Date(),
          description: `Write file: ${path}`
        };

        this.operationHistory.recordOperation(operation);
      }

      const duration = Date.now() - startTime;
      this.logger.info('File written successfully', { path, size: metadata.size, duration });

      return {
        success: true,
        operationId,
        data: metadata,
        timestamp: new Date(),
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Failed to write file', error as Error, { path, operationId });

      return {
        success: false,
        operationId,
        error: (error as Error).message,
        timestamp: new Date(),
        duration
      };
    }
  }

  /**
   * Write multiple files in batch
   */
  async writeBatch(writes: Array<{ path: string; content: Buffer | string; options?: BackupOptions }>): Promise<BatchResult> {
    const operations = writes.map(write => ({
      id: uuidv4(),
      type: FileOperationType.WRITE,
      params: write,
      priority: 2
    }));

    return this.batchOps.executeBatch(operations);
  }

  /**
   * Parse file using appropriate parser
   */
  async parse(path: string): Promise<FileOperationResult<ParsedContent>> {
    const startTime = Date.now();
    const operationId = uuidv4();

    try {
      this.logger.info('Parsing file', { path, operationId });

      const metadata = await this.metadataManager.getMetadata(path);
      const content = await readFile(path);

      const parser = this.parserRegistry.getParser(metadata.extension);
      if (!parser) {
        throw new FileServiceError(
          `No parser available for file type: ${metadata.extension}`,
          'PARSER_NOT_FOUND',
          { extension: metadata.extension }
        );
      }

      const parsed = await parser.parse(content, metadata);

      // Store parsed content in database
      this.storeParsedContent(parsed);

      const duration = Date.now() - startTime;
      this.logger.info('File parsed successfully', { path, type: parsed.type, duration });

      return {
        success: true,
        operationId,
        data: parsed,
        timestamp: new Date(),
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Failed to parse file', error as Error, { path, operationId });

      return {
        success: false,
        operationId,
        error: (error as Error).message,
        timestamp: new Date(),
        duration
      };
    }
  }

  /**
   * Parse multiple files in batch
   */
  async parseBatch(paths: string[]): Promise<BatchResult> {
    const operations = paths.map(path => ({
      id: uuidv4(),
      type: FileOperationType.PARSE,
      params: { path },
      priority: 1
    }));

    return this.batchOps.executeBatch(operations);
  }

  /**
   * Copy file to destination
   */
  async copy(sourcePath: string, destPath: string): Promise<FileOperationResult<FileMetadata>> {
    const startTime = Date.now();
    const operationId = uuidv4();

    try {
      this.logger.info('Copying file', { sourcePath, destPath, operationId });

      await mkdir(dirname(destPath), { recursive: true });
      await copyFile(sourcePath, destPath);
      const metadata = await this.metadataManager.getMetadata(destPath, true);

      // Record operation for undo
      if (this.options.enableHistory) {
        const operation: UndoableOperation = {
          id: operationId,
          type: FileOperationType.COPY,
          execute: async () => {
            await copyFile(sourcePath, destPath);
          },
          undo: async () => {
            await unlink(destPath);
            this.metadataManager.deleteMetadata(destPath);
          },
          timestamp: new Date(),
          description: `Copy file: ${sourcePath} -> ${destPath}`
        };

        this.operationHistory.recordOperation(operation);
      }

      const duration = Date.now() - startTime;
      this.logger.info('File copied successfully', { sourcePath, destPath, duration });

      return {
        success: true,
        operationId,
        data: metadata,
        timestamp: new Date(),
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Failed to copy file', error as Error, { sourcePath, destPath, operationId });

      return {
        success: false,
        operationId,
        error: (error as Error).message,
        timestamp: new Date(),
        duration
      };
    }
  }

  /**
   * Move/rename file
   */
  async move(sourcePath: string, destPath: string): Promise<FileOperationResult<FileMetadata>> {
    const startTime = Date.now();
    const operationId = uuidv4();

    try {
      this.logger.info('Moving file', { sourcePath, destPath, operationId });

      // Create backup if enabled
      let backupId: string | undefined;
      if (this.options.enableBackup) {
        const backup = await this.backupManager.createBackup(sourcePath);
        backupId = backup.id;
      }

      await mkdir(dirname(destPath), { recursive: true });
      await rename(sourcePath, destPath);

      // Update metadata
      this.metadataManager.deleteMetadata(sourcePath);
      const metadata = await this.metadataManager.getMetadata(destPath, true);

      // Record operation for undo
      if (this.options.enableHistory) {
        const operation: UndoableOperation = {
          id: operationId,
          type: FileOperationType.MOVE,
          execute: async () => {
            await rename(sourcePath, destPath);
          },
          undo: async () => {
            if (backupId) {
              await this.backupManager.restoreBackup({ backupId });
            } else {
              await rename(destPath, sourcePath);
            }
          },
          timestamp: new Date(),
          description: `Move file: ${sourcePath} -> ${destPath}`
        };

        this.operationHistory.recordOperation(operation);
      }

      const duration = Date.now() - startTime;
      this.logger.info('File moved successfully', { sourcePath, destPath, duration });

      return {
        success: true,
        operationId,
        data: metadata,
        timestamp: new Date(),
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Failed to move file', error as Error, { sourcePath, destPath, operationId });

      return {
        success: false,
        operationId,
        error: (error as Error).message,
        timestamp: new Date(),
        duration
      };
    }
  }

  /**
   * Delete file with backup
   */
  async delete(path: string): Promise<FileOperationResult<void>> {
    const startTime = Date.now();
    const operationId = uuidv4();

    try {
      this.logger.info('Deleting file', { path, operationId });

      // Create backup if enabled
      let backupId: string | undefined;
      if (this.options.enableBackup) {
        const backup = await this.backupManager.createBackup(path);
        backupId = backup.id;
      }

      await unlink(path);
      this.metadataManager.deleteMetadata(path);

      // Record operation for undo
      if (this.options.enableHistory && backupId) {
        const operation: UndoableOperation = {
          id: operationId,
          type: FileOperationType.DELETE,
          execute: async () => {
            await unlink(path);
          },
          undo: async () => {
            if (backupId) {
              await this.backupManager.restoreBackup({ backupId, overwrite: true });
            }
          },
          timestamp: new Date(),
          description: `Delete file: ${path}`
        };

        this.operationHistory.recordOperation(operation);
      }

      const duration = Date.now() - startTime;
      this.logger.info('File deleted successfully', { path, duration });

      return {
        success: true,
        operationId,
        timestamp: new Date(),
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Failed to delete file', error as Error, { path, operationId });

      return {
        success: false,
        operationId,
        error: (error as Error).message,
        timestamp: new Date(),
        duration
      };
    }
  }

  /**
   * Rename file (shorthand for move)
   */
  async rename(oldPath: string, newPath: string): Promise<FileOperationResult<FileMetadata>> {
    return this.move(oldPath, newPath);
  }

  /**
   * Backup and restore operations
   */
  async backup(path: string, options?: BackupOptions): Promise<FileOperationResult<{ backupId: string }>> {
    const startTime = Date.now();
    const operationId = uuidv4();

    try {
      const backup = await this.backupManager.createBackup(path, options);
      const duration = Date.now() - startTime;

      this.logger.info('Backup created', { path, backupId: backup.id, duration });

      return {
        success: true,
        operationId,
        data: { backupId: backup.id },
        timestamp: new Date(),
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        success: false,
        operationId,
        error: (error as Error).message,
        timestamp: new Date(),
        duration
      };
    }
  }

  async restore(backupId: string, targetPath?: string): Promise<FileOperationResult<string[]>> {
    const startTime = Date.now();
    const operationId = uuidv4();

    try {
      const restoredFiles = await this.backupManager.restoreBackup({
        backupId,
        targetPath,
        overwrite: true,
        validateChecksum: true
      });

      const duration = Date.now() - startTime;
      this.logger.info('Backup restored', { backupId, filesRestored: restoredFiles.length, duration });

      return {
        success: true,
        operationId,
        data: restoredFiles,
        timestamp: new Date(),
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        success: false,
        operationId,
        error: (error as Error).message,
        timestamp: new Date(),
        duration
      };
    }
  }

  /**
   * Undo/redo operations
   */
  async undo(): Promise<boolean> {
    return this.operationHistory.undoLast();
  }

  async redo(): Promise<boolean> {
    return this.operationHistory.redoLast();
  }

  async undoOperation(operationId: string): Promise<boolean> {
    return this.operationHistory.undoOperation(operationId);
  }

  canUndo(): boolean {
    return this.operationHistory.canUndo();
  }

  canRedo(): boolean {
    return this.operationHistory.canRedo();
  }

  getHistory(limit?: number) {
    return this.operationHistory.getHistory(limit);
  }

  /**
   * Metadata search operations
   */
  searchFiles(criteria: {
    extension?: string;
    minSize?: number;
    maxSize?: number;
    modifiedAfter?: Date;
    modifiedBefore?: Date;
  }): FileMetadata[] {
    return this.metadataManager.searchMetadata(criteria);
  }

  /**
   * Store parsed content in database
   */
  private storeParsedContent(parsed: ParsedContent): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO parsed_content
      (id, file_id, type, extracted_text, metadata, pages, sheets)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      uuidv4(),
      parsed.fileId,
      parsed.type,
      parsed.extractedText || null,
      JSON.stringify(parsed.metadata),
      parsed.pages || null,
      parsed.sheets ? JSON.stringify(parsed.sheets) : null
    );
  }

  /**
   * Get service statistics
   */
  getStatistics() {
    return {
      metadata: this.metadataManager.getStatistics(),
      backups: this.backupManager.getStatistics(),
      operations: this.operationHistory.getStatistics(),
      parsers: {
        supportedExtensions: this.parserRegistry.getSupportedExtensions()
      }
    };
  }

  /**
   * Cleanup and maintenance
   */
  clearCache(): void {
    this.metadataManager.clearCache();
  }

  vacuum(): void {
    this.metadataManager.vacuum();
  }
}
