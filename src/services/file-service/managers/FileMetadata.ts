/**
 * File metadata manager with database persistence
 * Handles metadata storage, retrieval, and caching
 */

import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { stat } from 'fs/promises';
import { basename, extname } from 'path';
import { DatabaseManager } from '../../../database/Database';
import { FileMetadata } from '../../../shared/types';
import { Logger } from '../../../shared/utils/logger';
import { FileServiceError } from '../../../shared/utils/errors';

export class FileMetadataManager {
  private logger: Logger;
  private db: DatabaseManager;
  private metadataCache: Map<string, FileMetadata>;
  private readonly CACHE_SIZE = 1000;

  constructor(db: DatabaseManager) {
    this.logger = new Logger('FileMetadataManager');
    this.db = db;
    this.metadataCache = new Map();
    this.initializeDatabase();
  }

  /**
   * Initialize database tables for metadata
   */
  private initializeDatabase(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS file_metadata (
        id TEXT PRIMARY KEY,
        path TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        extension TEXT NOT NULL,
        size INTEGER NOT NULL,
        created TEXT NOT NULL,
        modified TEXT NOT NULL,
        accessed TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        encoding TEXT,
        checksum TEXT NOT NULL,
        indexed_at TEXT NOT NULL,
        UNIQUE(path)
      );

      CREATE INDEX IF NOT EXISTS idx_file_path ON file_metadata(path);
      CREATE INDEX IF NOT EXISTS idx_file_extension ON file_metadata(extension);
      CREATE INDEX IF NOT EXISTS idx_file_modified ON file_metadata(modified);
      CREATE INDEX IF NOT EXISTS idx_file_checksum ON file_metadata(checksum);
    `);
  }

  /**
   * Get or create file metadata
   */
  async getMetadata(path: string, forceRefresh = false): Promise<FileMetadata> {
    try {
      // Check cache first
      if (!forceRefresh && this.metadataCache.has(path)) {
        return this.metadataCache.get(path)!;
      }

      // Check database
      const cached = this.getFromDatabase(path);
      if (cached && !forceRefresh) {
        this.cacheMetadata(cached);
        return cached;
      }

      // Generate fresh metadata
      const metadata = await this.generateMetadata(path);
      this.storeMetadata(metadata);
      this.cacheMetadata(metadata);

      return metadata;
    } catch (error) {
      this.logger.error('Failed to get metadata', error as Error, { path });
      throw new FileServiceError(
        `Failed to get metadata for ${path}`,
        'METADATA_ERROR',
        { path, error: (error as Error).message }
      );
    }
  }

  /**
   * Generate file metadata from filesystem
   */
  private async generateMetadata(path: string): Promise<FileMetadata> {
    try {
      const stats = await stat(path);
      const extension = extname(path).toLowerCase();

      return {
        id: uuidv4(),
        path,
        name: basename(path),
        extension,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        accessed: stats.atime,
        mimeType: this.getMimeType(extension),
        checksum: '' // Will be calculated if needed
      };
    } catch (error) {
      throw new FileServiceError(
        `Failed to read file stats: ${(error as Error).message}`,
        'FS_ERROR',
        { path }
      );
    }
  }

  /**
   * Calculate file checksum
   */
  async calculateChecksum(content: Buffer): Promise<string> {
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Update metadata with checksum
   */
  async updateChecksum(metadata: FileMetadata, content: Buffer): Promise<FileMetadata> {
    const checksum = await this.calculateChecksum(content);
    const updated = { ...metadata, checksum };
    this.storeMetadata(updated);
    return updated;
  }

  /**
   * Store metadata in database
   */
  private storeMetadata(metadata: FileMetadata): void {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO file_metadata
        (id, path, name, extension, size, created, modified, accessed, mime_type, encoding, checksum, indexed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        metadata.id,
        metadata.path,
        metadata.name,
        metadata.extension,
        metadata.size,
        metadata.created.toISOString(),
        metadata.modified.toISOString(),
        metadata.accessed.toISOString(),
        metadata.mimeType,
        metadata.encoding || null,
        metadata.checksum || null,
        new Date().toISOString()
      );

      this.logger.debug('Metadata stored', { path: metadata.path });
    } catch (error) {
      this.logger.error('Failed to store metadata', error as Error, { path: metadata.path });
      throw new FileServiceError(
        'Failed to store metadata',
        'DB_ERROR',
        { path: metadata.path, error: (error as Error).message }
      );
    }
  }

  /**
   * Get metadata from database
   */
  private getFromDatabase(path: string): FileMetadata | null {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM file_metadata WHERE path = ?
      `);

      const row = stmt.get(path) as any;
      if (!row) return null;

      return {
        id: row.id,
        path: row.path,
        name: row.name,
        extension: row.extension,
        size: row.size,
        created: new Date(row.created),
        modified: new Date(row.modified),
        accessed: new Date(row.accessed),
        mimeType: row.mime_type,
        encoding: row.encoding,
        checksum: row.checksum
      };
    } catch (error) {
      this.logger.error('Failed to get metadata from database', error as Error, { path });
      return null;
    }
  }

  /**
   * Cache metadata in memory
   */
  private cacheMetadata(metadata: FileMetadata): void {
    if (this.metadataCache.size >= this.CACHE_SIZE) {
      // Remove oldest entry
      const firstKey = this.metadataCache.keys().next().value;
      this.metadataCache.delete(firstKey);
    }
    this.metadataCache.set(metadata.path, metadata);
  }

  /**
   * Delete metadata
   */
  deleteMetadata(path: string): void {
    try {
      const stmt = this.db.prepare('DELETE FROM file_metadata WHERE path = ?');
      stmt.run(path);
      this.metadataCache.delete(path);
      this.logger.debug('Metadata deleted', { path });
    } catch (error) {
      this.logger.error('Failed to delete metadata', error as Error, { path });
    }
  }

  /**
   * Bulk metadata retrieval
   */
  async getBulkMetadata(paths: string[]): Promise<Map<string, FileMetadata>> {
    const results = new Map<string, FileMetadata>();

    await Promise.all(
      paths.map(async (path) => {
        try {
          const metadata = await this.getMetadata(path);
          results.set(path, metadata);
        } catch (error) {
          this.logger.warn('Failed to get metadata for path', { path, error: (error as Error).message });
        }
      })
    );

    return results;
  }

  /**
   * Search metadata by criteria
   */
  searchMetadata(criteria: {
    extension?: string;
    minSize?: number;
    maxSize?: number;
    modifiedAfter?: Date;
    modifiedBefore?: Date;
  }): FileMetadata[] {
    let query = 'SELECT * FROM file_metadata WHERE 1=1';
    const params: any[] = [];

    if (criteria.extension) {
      query += ' AND extension = ?';
      params.push(criteria.extension);
    }

    if (criteria.minSize !== undefined) {
      query += ' AND size >= ?';
      params.push(criteria.minSize);
    }

    if (criteria.maxSize !== undefined) {
      query += ' AND size <= ?';
      params.push(criteria.maxSize);
    }

    if (criteria.modifiedAfter) {
      query += ' AND modified >= ?';
      params.push(criteria.modifiedAfter.toISOString());
    }

    if (criteria.modifiedBefore) {
      query += ' AND modified <= ?';
      params.push(criteria.modifiedBefore.toISOString());
    }

    query += ' ORDER BY modified DESC LIMIT 1000';

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => ({
      id: row.id,
      path: row.path,
      name: row.name,
      extension: row.extension,
      size: row.size,
      created: new Date(row.created),
      modified: new Date(row.modified),
      accessed: new Date(row.accessed),
      mimeType: row.mime_type,
      encoding: row.encoding,
      checksum: row.checksum
    }));
  }

  /**
   * Get MIME type from extension
   */
  private getMimeType(extension: string): string {
    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.xls': 'application/vnd.ms-excel',
      '.csv': 'text/csv',
      '.txt': 'text/plain',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp'
    };

    return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalFiles: number;
    totalSize: number;
    byExtension: Record<string, number>;
    cacheSize: number;
  } {
    const stmt = this.db.prepare(`
      SELECT
        COUNT(*) as count,
        SUM(size) as total_size,
        extension,
        COUNT(*) as ext_count
      FROM file_metadata
      GROUP BY extension
    `);

    const rows = stmt.all() as any[];
    const totalFiles = rows.length > 0 ? rows[0].count : 0;
    const totalSize = rows.length > 0 ? rows[0].total_size : 0;

    const byExtension: Record<string, number> = {};
    rows.forEach(row => {
      byExtension[row.extension] = row.ext_count;
    });

    return {
      totalFiles,
      totalSize,
      byExtension,
      cacheSize: this.metadataCache.size
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.metadataCache.clear();
    this.logger.info('Metadata cache cleared');
  }

  /**
   * Vacuum database
   */
  vacuum(): void {
    this.db.exec('VACUUM');
    this.logger.info('Database vacuumed');
  }
}
