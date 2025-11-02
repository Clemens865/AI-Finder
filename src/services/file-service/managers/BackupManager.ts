/**
 * Backup and restore manager for file operations
 * Provides safety net for destructive operations
 */

import { readFile, writeFile, mkdir, unlink, stat, copyFile } from 'fs/promises';
import { join, dirname, basename } from 'path';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseManager } from '../../../database/Database';
import { BackupMetadata, RestoreOptions } from '../../../shared/types';
import { Logger } from '../../../shared/utils/logger';
import { BackupError } from '../../../shared/utils/errors';

export interface BackupOptions {
  description?: string;
  compress?: boolean;
  encrypt?: boolean;
}

export interface BackupInfo extends BackupMetadata {
  backupPath: string;
}

export class BackupManager {
  private logger: Logger;
  private db: DatabaseManager;
  private backupRoot: string;
  private maxBackups: number = 100;
  private maxBackupAge: number = 30 * 24 * 60 * 60 * 1000; // 30 days

  constructor(db: DatabaseManager, backupRoot: string) {
    this.logger = new Logger('BackupManager');
    this.db = db;
    this.backupRoot = backupRoot;
    this.initializeDatabase();
  }

  /**
   * Initialize backup database tables
   */
  private initializeDatabase(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS backups (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        files TEXT NOT NULL,
        size INTEGER NOT NULL,
        checksum TEXT NOT NULL,
        description TEXT,
        backup_path TEXT NOT NULL,
        restored INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_backup_timestamp ON backups(timestamp);
      CREATE INDEX IF NOT EXISTS idx_backup_files ON backups(files);
    `);
  }

  /**
   * Create backup of a file
   */
  async createBackup(
    filePath: string,
    options: BackupOptions = {}
  ): Promise<BackupInfo> {
    const startTime = Date.now();
    const backupId = uuidv4();

    try {
      this.logger.info('Creating backup', { filePath, backupId });

      // Ensure backup directory exists
      await mkdir(this.backupRoot, { recursive: true });

      // Read file content
      const content = await readFile(filePath);
      const checksum = createHash('sha256').update(content).digest('hex');

      // Create backup path
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = basename(filePath);
      const backupPath = join(
        this.backupRoot,
        `${timestamp}_${backupId}_${filename}`
      );

      // Write backup
      await writeFile(backupPath, content);

      // Verify backup
      const backupStats = await stat(backupPath);
      if (backupStats.size !== content.length) {
        throw new BackupError(
          'Backup verification failed: size mismatch',
          'backup'
        );
      }

      // Create metadata
      const metadata: BackupInfo = {
        id: backupId,
        timestamp: new Date(),
        files: [filePath],
        size: content.length,
        checksum,
        description: options.description,
        backupPath
      };

      // Store in database
      this.storeBackupMetadata(metadata);

      // Cleanup old backups
      await this.cleanupOldBackups();

      const duration = Date.now() - startTime;
      this.logger.info('Backup created successfully', {
        backupId,
        filePath,
        size: content.length,
        duration
      });

      return metadata;
    } catch (error) {
      this.logger.error('Failed to create backup', error as Error, { filePath, backupId });
      throw new BackupError(
        `Failed to create backup: ${(error as Error).message}`,
        'backup'
      );
    }
  }

  /**
   * Create backup of multiple files
   */
  async createBatchBackup(
    filePaths: string[],
    options: BackupOptions = {}
  ): Promise<BackupInfo> {
    const startTime = Date.now();
    const backupId = uuidv4();

    try {
      this.logger.info('Creating batch backup', { fileCount: filePaths.length, backupId });

      await mkdir(this.backupRoot, { recursive: true });

      const backupDir = join(this.backupRoot, backupId);
      await mkdir(backupDir, { recursive: true });

      let totalSize = 0;
      const checksums: string[] = [];

      // Backup each file
      for (const filePath of filePaths) {
        const content = await readFile(filePath);
        const checksum = createHash('sha256').update(content).digest('hex');
        checksums.push(checksum);

        const filename = basename(filePath);
        const backupPath = join(backupDir, filename);

        await mkdir(dirname(backupPath), { recursive: true });
        await writeFile(backupPath, content);

        totalSize += content.length;
      }

      // Combined checksum
      const combinedChecksum = createHash('sha256')
        .update(checksums.join(''))
        .digest('hex');

      const metadata: BackupInfo = {
        id: backupId,
        timestamp: new Date(),
        files: filePaths,
        size: totalSize,
        checksum: combinedChecksum,
        description: options.description,
        backupPath: backupDir
      };

      this.storeBackupMetadata(metadata);
      await this.cleanupOldBackups();

      const duration = Date.now() - startTime;
      this.logger.info('Batch backup created successfully', {
        backupId,
        fileCount: filePaths.length,
        totalSize,
        duration
      });

      return metadata;
    } catch (error) {
      this.logger.error('Failed to create batch backup', error as Error, { backupId });
      throw new BackupError(
        `Failed to create batch backup: ${(error as Error).message}`,
        'backup'
      );
    }
  }

  /**
   * Restore file from backup
   */
  async restoreBackup(options: RestoreOptions): Promise<string[]> {
    const startTime = Date.now();

    try {
      this.logger.info('Restoring backup', { backupId: options.backupId });

      // Get backup metadata
      const metadata = this.getBackupMetadata(options.backupId);
      if (!metadata) {
        throw new BackupError(`Backup not found: ${options.backupId}`, 'restore');
      }

      const restoredFiles: string[] = [];

      // Restore single file backup
      if (metadata.files.length === 1) {
        const originalPath = metadata.files[0];
        const targetPath = options.targetPath || originalPath;

        await this.restoreSingleFile(
          metadata.backupPath,
          targetPath,
          options.overwrite || false,
          options.validateChecksum || false
        );

        restoredFiles.push(targetPath);
      } else {
        // Restore batch backup
        for (const originalPath of metadata.files) {
          const filename = basename(originalPath);
          const backupPath = join(metadata.backupPath, filename);
          const targetPath = options.targetPath
            ? join(options.targetPath, filename)
            : originalPath;

          await this.restoreSingleFile(
            backupPath,
            targetPath,
            options.overwrite || false,
            false
          );

          restoredFiles.push(targetPath);
        }
      }

      // Mark as restored
      this.markBackupRestored(options.backupId);

      const duration = Date.now() - startTime;
      this.logger.info('Backup restored successfully', {
        backupId: options.backupId,
        filesRestored: restoredFiles.length,
        duration
      });

      return restoredFiles;
    } catch (error) {
      this.logger.error('Failed to restore backup', error as Error, { backupId: options.backupId });
      throw new BackupError(
        `Failed to restore backup: ${(error as Error).message}`,
        'restore'
      );
    }
  }

  /**
   * Restore a single file
   */
  private async restoreSingleFile(
    backupPath: string,
    targetPath: string,
    overwrite: boolean,
    validateChecksum: boolean
  ): Promise<void> {
    // Check if target exists
    try {
      await stat(targetPath);
      if (!overwrite) {
        throw new BackupError(
          `Target file exists and overwrite is false: ${targetPath}`,
          'restore'
        );
      }
    } catch {
      // File doesn't exist, proceed with restore
    }

    // Ensure target directory exists
    await mkdir(dirname(targetPath), { recursive: true });

    // Copy backup to target
    await copyFile(backupPath, targetPath);

    // Validate checksum if requested
    if (validateChecksum) {
      const content = await readFile(targetPath);
      const checksum = createHash('sha256').update(content).digest('hex');

      const backupContent = await readFile(backupPath);
      const backupChecksum = createHash('sha256').update(backupContent).digest('hex');

      if (checksum !== backupChecksum) {
        throw new BackupError(
          'Restore verification failed: checksum mismatch',
          'restore'
        );
      }
    }
  }

  /**
   * Delete backup
   */
  async deleteBackup(backupId: string): Promise<void> {
    try {
      const metadata = this.getBackupMetadata(backupId);
      if (!metadata) {
        throw new BackupError(`Backup not found: ${backupId}`, 'backup');
      }

      // Delete backup files
      try {
        await unlink(metadata.backupPath);
      } catch (error) {
        this.logger.warn('Failed to delete backup file', { backupPath: metadata.backupPath });
      }

      // Remove from database
      const stmt = this.db.prepare('DELETE FROM backups WHERE id = ?');
      stmt.run(backupId);

      this.logger.info('Backup deleted', { backupId });
    } catch (error) {
      this.logger.error('Failed to delete backup', error as Error, { backupId });
      throw new BackupError(
        `Failed to delete backup: ${(error as Error).message}`,
        'backup'
      );
    }
  }

  /**
   * List all backups
   */
  listBackups(filePath?: string): BackupInfo[] {
    let query = 'SELECT * FROM backups';
    const params: any[] = [];

    if (filePath) {
      query += ' WHERE files LIKE ?';
      params.push(`%${filePath}%`);
    }

    query += ' ORDER BY timestamp DESC';

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => ({
      id: row.id,
      timestamp: new Date(row.timestamp),
      files: JSON.parse(row.files),
      size: row.size,
      checksum: row.checksum,
      description: row.description,
      backupPath: row.backup_path
    }));
  }

  /**
   * Get backup metadata
   */
  private getBackupMetadata(backupId: string): BackupInfo | null {
    const stmt = this.db.prepare('SELECT * FROM backups WHERE id = ?');
    const row = stmt.get(backupId) as any;

    if (!row) return null;

    return {
      id: row.id,
      timestamp: new Date(row.timestamp),
      files: JSON.parse(row.files),
      size: row.size,
      checksum: row.checksum,
      description: row.description,
      backupPath: row.backup_path
    };
  }

  /**
   * Store backup metadata
   */
  private storeBackupMetadata(metadata: BackupInfo): void {
    const stmt = this.db.prepare(`
      INSERT INTO backups
      (id, timestamp, files, size, checksum, description, backup_path, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      metadata.id,
      metadata.timestamp.toISOString(),
      JSON.stringify(metadata.files),
      metadata.size,
      metadata.checksum,
      metadata.description || null,
      metadata.backupPath,
      new Date().toISOString()
    );
  }

  /**
   * Mark backup as restored
   */
  private markBackupRestored(backupId: string): void {
    const stmt = this.db.prepare('UPDATE backups SET restored = 1 WHERE id = ?');
    stmt.run(backupId);
  }

  /**
   * Cleanup old backups
   */
  private async cleanupOldBackups(): Promise<void> {
    try {
      // Get all backups
      const allBackups = this.listBackups();

      // Remove oldest if exceeds max count
      if (allBackups.length > this.maxBackups) {
        const toRemove = allBackups
          .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
          .slice(0, allBackups.length - this.maxBackups);

        for (const backup of toRemove) {
          await this.deleteBackup(backup.id);
        }

        this.logger.info('Cleaned up old backups', { removed: toRemove.length });
      }

      // Remove backups older than max age
      const cutoffDate = new Date(Date.now() - this.maxBackupAge);
      const oldBackups = allBackups.filter(b => b.timestamp < cutoffDate);

      for (const backup of oldBackups) {
        await this.deleteBackup(backup.id);
      }

      if (oldBackups.length > 0) {
        this.logger.info('Cleaned up expired backups', { removed: oldBackups.length });
      }
    } catch (error) {
      this.logger.error('Failed to cleanup old backups', error as Error);
    }
  }

  /**
   * Get backup statistics
   */
  getStatistics(): {
    totalBackups: number;
    totalSize: number;
    oldestBackup: Date | null;
    newestBackup: Date | null;
  } {
    const stmt = this.db.prepare(`
      SELECT
        COUNT(*) as count,
        SUM(size) as total_size,
        MIN(timestamp) as oldest,
        MAX(timestamp) as newest
      FROM backups
    `);

    const row = stmt.get() as any;

    return {
      totalBackups: row.count || 0,
      totalSize: row.total_size || 0,
      oldestBackup: row.oldest ? new Date(row.oldest) : null,
      newestBackup: row.newest ? new Date(row.newest) : null
    };
  }
}
