/**
 * Backup and restore service with undo/redo capabilities
 */

import { copyFile, mkdir, readFile, writeFile } from 'fs/promises';
import { createHash } from 'crypto';
import { join, basename } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../../shared/utils/logger';
import { BackupError } from '../../shared/utils/errors';
import {
  BackupMetadata,
  RestoreOptions,
  UndoableOperation,
  HistoryEntry,
  FileOperationType
} from '../../shared/types';
import { DatabaseManager } from '../../database/Database';

export class BackupService {
  private logger: Logger;
  private db: DatabaseManager;
  private backupDir: string;
  private history: HistoryEntry[];
  private currentIndex: number;
  private maxHistorySize: number = 100;

  constructor(db: DatabaseManager, backupDir: string) {
    this.logger = new Logger('BackupService');
    this.db = db;
    this.backupDir = backupDir;
    this.history = [];
    this.currentIndex = -1;
  }

  /**
   * Create backup of files
   */
  async createBackup(
    files: string[],
    description?: string
  ): Promise<BackupMetadata> {
    const backupId = uuidv4();
    const timestamp = new Date();
    const backupPath = join(this.backupDir, backupId);

    this.logger.info('Creating backup', { backupId, fileCount: files.length });

    try {
      await mkdir(backupPath, { recursive: true });

      let totalSize = 0;
      const checksums: string[] = [];

      // Copy files and calculate checksums
      for (const filePath of files) {
        const content = await readFile(filePath);
        const fileName = basename(filePath);
        const destPath = join(backupPath, fileName);

        await writeFile(destPath, content);

        totalSize += content.length;
        checksums.push(createHash('sha256').update(content).digest('hex'));
      }

      // Create backup checksum
      const backupChecksum = createHash('sha256')
        .update(checksums.join(''))
        .digest('hex');

      const metadata: BackupMetadata = {
        id: backupId,
        timestamp,
        files,
        size: totalSize,
        checksum: backupChecksum,
        description
      };

      // Store in database
      this.storeBackupMetadata(metadata, backupPath);

      this.logger.info('Backup created successfully', {
        backupId,
        size: totalSize,
        fileCount: files.length
      });

      return metadata;
    } catch (error) {
      this.logger.error('Failed to create backup', error as Error, { backupId });
      throw new BackupError(
        `Failed to create backup: ${(error as Error).message}`,
        'backup'
      );
    }
  }

  /**
   * Restore files from backup
   */
  async restoreBackup(options: RestoreOptions): Promise<void> {
    this.logger.info('Restoring backup', { backupId: options.backupId });

    try {
      // Get backup metadata
      const metadata = await this.getBackupMetadata(options.backupId);
      if (!metadata) {
        throw new BackupError(`Backup not found: ${options.backupId}`, 'restore');
      }

      const backupPath = join(this.backupDir, options.backupId);

      // Restore each file
      for (const filePath of metadata.files) {
        const fileName = basename(filePath);
        const sourcePath = join(backupPath, fileName);
        const targetPath = options.targetPath
          ? join(options.targetPath, fileName)
          : filePath;

        if (options.overwrite || !await this.fileExists(targetPath)) {
          await mkdir(join(targetPath, '..'), { recursive: true });
          await copyFile(sourcePath, targetPath);
        }
      }

      this.logger.info('Backup restored successfully', {
        backupId: options.backupId,
        fileCount: metadata.files.length
      });
    } catch (error) {
      this.logger.error('Failed to restore backup', error as Error, {
        backupId: options.backupId
      });
      throw new BackupError(
        `Failed to restore backup: ${(error as Error).message}`,
        'restore'
      );
    }
  }

  /**
   * Add operation to undo/redo history
   */
  async recordOperation(operation: UndoableOperation): Promise<void> {
    // Remove any operations after current index (when doing new operation after undo)
    this.history = this.history.slice(0, this.currentIndex + 1);

    // Add new operation
    const entry: HistoryEntry = {
      operation,
      state: 'executed',
      timestamp: new Date()
    };

    this.history.push(entry);
    this.currentIndex++;

    // Limit history size
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
      this.currentIndex--;
    }

    // Store in database
    this.storeHistoryEntry(entry);

    this.logger.debug('Operation recorded', {
      operationId: operation.id,
      type: operation.type,
      historySize: this.history.length
    });
  }

  /**
   * Undo last operation
   */
  async undo(): Promise<boolean> {
    if (this.currentIndex < 0) {
      this.logger.warn('No operations to undo');
      return false;
    }

    const entry = this.history[this.currentIndex];
    this.logger.info('Undoing operation', {
      operationId: entry.operation.id,
      type: entry.operation.type
    });

    try {
      await entry.operation.undo();
      entry.state = 'undone';
      this.currentIndex--;

      // Update database
      this.updateHistoryEntry(entry);

      return true;
    } catch (error) {
      this.logger.error('Failed to undo operation', error as Error, {
        operationId: entry.operation.id
      });
      throw error;
    }
  }

  /**
   * Redo previously undone operation
   */
  async redo(): Promise<boolean> {
    if (this.currentIndex >= this.history.length - 1) {
      this.logger.warn('No operations to redo');
      return false;
    }

    const entry = this.history[this.currentIndex + 1];
    this.logger.info('Redoing operation', {
      operationId: entry.operation.id,
      type: entry.operation.type
    });

    try {
      await entry.operation.execute();
      entry.state = 'executed';
      this.currentIndex++;

      // Update database
      this.updateHistoryEntry(entry);

      return true;
    } catch (error) {
      this.logger.error('Failed to redo operation', error as Error, {
        operationId: entry.operation.id
      });
      throw error;
    }
  }

  /**
   * Get undo/redo history
   */
  getHistory(): HistoryEntry[] {
    return [...this.history];
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history = [];
    this.currentIndex = -1;

    const stmt = this.db.prepare('DELETE FROM operation_history');
    stmt.run();

    this.logger.info('History cleared');
  }

  /**
   * Check if file exists
   */
  private async fileExists(path: string): Promise<boolean> {
    try {
      await readFile(path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Store backup metadata in database
   */
  private storeBackupMetadata(metadata: BackupMetadata, backupPath: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO backups
      (id, timestamp, files, size, checksum, description, backup_path)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      metadata.id,
      metadata.timestamp.toISOString(),
      JSON.stringify(metadata.files),
      metadata.size,
      metadata.checksum,
      metadata.description || null,
      backupPath
    );
  }

  /**
   * Get backup metadata from database
   */
  private async getBackupMetadata(backupId: string): Promise<BackupMetadata | null> {
    const stmt = this.db.prepare('SELECT * FROM backups WHERE id = ?');
    const row = stmt.get(backupId) as any;

    if (!row) return null;

    return {
      id: row.id,
      timestamp: new Date(row.timestamp),
      files: JSON.parse(row.files),
      size: row.size,
      checksum: row.checksum,
      description: row.description
    };
  }

  /**
   * Store history entry in database
   */
  private storeHistoryEntry(entry: HistoryEntry): void {
    const stmt = this.db.prepare(`
      INSERT INTO operation_history
      (id, type, description, state, operation_data, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      entry.operation.id,
      entry.operation.type,
      entry.operation.description,
      entry.state,
      JSON.stringify({
        id: entry.operation.id,
        type: entry.operation.type,
        description: entry.operation.description
      }),
      entry.timestamp.toISOString()
    );
  }

  /**
   * Update history entry in database
   */
  private updateHistoryEntry(entry: HistoryEntry): void {
    const stmt = this.db.prepare(`
      UPDATE operation_history
      SET state = ?
      WHERE id = ?
    `);

    stmt.run(entry.state, entry.operation.id);
  }
}
