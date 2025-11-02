/**
 * Backup Manager - Advanced backup and restore functionality
 */

import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import { join, dirname, basename } from 'path';
import { SecuritySandbox } from '../security/SecuritySandbox';
import { nanoid } from 'nanoid';

export interface BackupInfo {
  id: string;
  originalPath: string;
  backupPath: string;
  timestamp: Date;
  size: number;
  checksum: string;
  operation?: string;
  metadata?: Record<string, any>;
}

export interface BackupOptions {
  maxBackups?: number;
  retentionDays?: number;
  compress?: boolean;
}

export class BackupManager {
  private security: SecuritySandbox;
  private backupDir: string;
  private backups: Map<string, BackupInfo> = new Map();
  private options: BackupOptions;

  constructor(security: SecuritySandbox, backupDir?: string, options: BackupOptions = {}) {
    this.security = security;
    this.backupDir = backupDir || join(security.getRootPath(), '.backups');
    this.options = {
      maxBackups: options.maxBackups || 100,
      retentionDays: options.retentionDays || 30,
      compress: options.compress || false
    };

    this.initialize();
  }

  /**
   * Initialize backup directory and load existing backups
   */
  private async initialize(): Promise<void> {
    try {
      // Ensure backup directory exists
      if (!existsSync(this.backupDir)) {
        await fs.mkdir(this.backupDir, { recursive: true });
      }

      // Load existing backup metadata
      await this.loadBackupMetadata();

      console.log(`[BackupManager] Initialized with ${this.backups.size} backups`);
    } catch (error) {
      console.error('[BackupManager] Initialization failed:', error);
    }
  }

  /**
   * Load backup metadata from disk
   */
  private async loadBackupMetadata(): Promise<void> {
    const metadataPath = join(this.backupDir, 'metadata.json');

    try {
      if (existsSync(metadataPath)) {
        const data = await fs.readFile(metadataPath, 'utf-8');
        const backupArray: BackupInfo[] = JSON.parse(data);

        for (const backup of backupArray) {
          this.backups.set(backup.id, {
            ...backup,
            timestamp: new Date(backup.timestamp)
          });
        }
      }
    } catch (error) {
      console.error('[BackupManager] Failed to load metadata:', error);
    }
  }

  /**
   * Save backup metadata to disk
   */
  private async saveBackupMetadata(): Promise<void> {
    const metadataPath = join(this.backupDir, 'metadata.json');

    try {
      const backupArray = Array.from(this.backups.values());
      await fs.writeFile(metadataPath, JSON.stringify(backupArray, null, 2));
    } catch (error) {
      console.error('[BackupManager] Failed to save metadata:', error);
    }
  }

  /**
   * Create a backup of a file
   */
  async createBackup(
    filePath: string,
    operation?: string,
    metadata?: Record<string, any>
  ): Promise<BackupInfo> {
    const resolvedPath = this.security.resolvePath(filePath);

    // Validate file exists
    if (!existsSync(resolvedPath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Generate backup ID and path
    const backupId = nanoid();
    const timestamp = Date.now();
    const fileName = basename(resolvedPath);
    const backupFileName = `${timestamp}_${backupId}_${fileName}`;
    const backupPath = join(this.backupDir, backupFileName);

    try {
      // Copy file to backup location
      await fs.copyFile(resolvedPath, backupPath);

      // Get file stats
      const stats = await fs.stat(backupPath);

      // Calculate checksum
      const checksum = await this.calculateChecksum(backupPath);

      // Create backup info
      const backupInfo: BackupInfo = {
        id: backupId,
        originalPath: resolvedPath,
        backupPath,
        timestamp: new Date(),
        size: stats.size,
        checksum,
        operation,
        metadata
      };

      // Store backup info
      this.backups.set(backupId, backupInfo);

      // Save metadata
      await this.saveBackupMetadata();

      // Cleanup old backups if needed
      await this.cleanupOldBackups();

      console.log(`[BackupManager] Backup created: ${backupId} for ${filePath}`);
      return backupInfo;
    } catch (error) {
      console.error('[BackupManager] Failed to create backup:', error);
      throw error;
    }
  }

  /**
   * Restore a file from backup
   */
  async restoreBackup(backupId: string): Promise<void> {
    const backup = this.backups.get(backupId);

    if (!backup) {
      throw new Error(`Backup not found: ${backupId}`);
    }

    if (!existsSync(backup.backupPath)) {
      throw new Error(`Backup file missing: ${backup.backupPath}`);
    }

    try {
      // Verify backup integrity
      const currentChecksum = await this.calculateChecksum(backup.backupPath);
      if (currentChecksum !== backup.checksum) {
        throw new Error('Backup file corrupted - checksum mismatch');
      }

      // Ensure destination directory exists
      await fs.mkdir(dirname(backup.originalPath), { recursive: true });

      // Create a backup of the current file before restoring
      if (existsSync(backup.originalPath)) {
        await this.createBackup(backup.originalPath, 'pre-restore');
      }

      // Restore the file
      await fs.copyFile(backup.backupPath, backup.originalPath);

      console.log(`[BackupManager] Backup restored: ${backupId}`);
    } catch (error) {
      console.error('[BackupManager] Failed to restore backup:', error);
      throw error;
    }
  }

  /**
   * Delete a backup
   */
  async deleteBackup(backupId: string): Promise<void> {
    const backup = this.backups.get(backupId);

    if (!backup) {
      throw new Error(`Backup not found: ${backupId}`);
    }

    try {
      // Delete backup file
      if (existsSync(backup.backupPath)) {
        await fs.unlink(backup.backupPath);
      }

      // Remove from map
      this.backups.delete(backupId);

      // Save metadata
      await this.saveBackupMetadata();

      console.log(`[BackupManager] Backup deleted: ${backupId}`);
    } catch (error) {
      console.error('[BackupManager] Failed to delete backup:', error);
      throw error;
    }
  }

  /**
   * Get backup info
   */
  getBackup(backupId: string): BackupInfo | undefined {
    return this.backups.get(backupId);
  }

  /**
   * Get all backups for a file
   */
  getBackupsForFile(filePath: string): BackupInfo[] {
    const resolvedPath = this.security.resolvePath(filePath);
    return Array.from(this.backups.values()).filter(
      backup => backup.originalPath === resolvedPath
    );
  }

  /**
   * Get all backups
   */
  getAllBackups(): BackupInfo[] {
    return Array.from(this.backups.values()).sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
  }

  /**
   * Cleanup old backups based on retention policy
   */
  private async cleanupOldBackups(): Promise<void> {
    const now = Date.now();
    const retentionMs = this.options.retentionDays! * 24 * 60 * 60 * 1000;
    const allBackups = this.getAllBackups();

    // Remove backups older than retention period
    for (const backup of allBackups) {
      const age = now - backup.timestamp.getTime();
      if (age > retentionMs) {
        await this.deleteBackup(backup.id);
      }
    }

    // Enforce max backups limit
    const remainingBackups = this.getAllBackups();
    if (remainingBackups.length > this.options.maxBackups!) {
      const toDelete = remainingBackups.slice(this.options.maxBackups!);
      for (const backup of toDelete) {
        await this.deleteBackup(backup.id);
      }
    }
  }

  /**
   * Calculate file checksum
   */
  private async calculateChecksum(filePath: string): Promise<string> {
    const { createHash } = await import('crypto');
    const { createReadStream } = await import('fs');

    return new Promise((resolve, reject) => {
      const hash = createHash('sha256');
      const stream = createReadStream(filePath);

      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Get backup statistics
   */
  getStatistics() {
    const backups = this.getAllBackups();
    const totalSize = backups.reduce((sum, backup) => sum + backup.size, 0);

    const operationCounts = backups.reduce((acc, backup) => {
      const op = backup.operation || 'unknown';
      acc[op] = (acc[op] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalBackups: backups.length,
      totalSize,
      averageSize: backups.length > 0 ? totalSize / backups.length : 0,
      oldestBackup: backups.length > 0 ? backups[backups.length - 1].timestamp : null,
      newestBackup: backups.length > 0 ? backups[0].timestamp : null,
      operationCounts,
      backupDirectory: this.backupDir
    };
  }

  /**
   * Cleanup on shutdown
   */
  async cleanup(): Promise<void> {
    await this.saveBackupMetadata();
    console.log('[BackupManager] Cleanup complete');
  }
}
