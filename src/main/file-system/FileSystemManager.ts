/**
 * File System Manager - Secure file operations with sandboxing
 */

import { promises as fs } from 'fs';
import { readFileSync, existsSync, statSync, createReadStream, createWriteStream } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { SecuritySandbox, OperationType } from '../security/SecuritySandbox';
import { FileContent, FileMetadata, FileType, FileReadOptions, WriteOptions, FileOperationError } from '@shared/types/ipc';
import { nanoid } from 'nanoid';
import { createHash } from 'crypto';

export class FileSystemManager {
  private security: SecuritySandbox;
  private backupDir: string;

  constructor(security: SecuritySandbox) {
    this.security = security;
    this.backupDir = join(security.getRootPath(), '.backups');
    this.ensureBackupDir();
  }

  /**
   * Ensure backup directory exists
   */
  private async ensureBackupDir(): Promise<void> {
    try {
      if (!existsSync(this.backupDir)) {
        await fs.mkdir(this.backupDir, { recursive: true });
      }
    } catch (error) {
      console.error('[FileSystem] Failed to create backup directory:', error);
    }
  }

  /**
   * Read a file
   */
  async read(path: string, options?: FileReadOptions): Promise<FileContent> {
    return this.security.executeOperation('read', path, async () => {
      const resolvedPath = this.security.resolvePath(path);

      try {
        // Check if file exists
        const stats = await fs.stat(resolvedPath);
        if (!stats.isFile()) {
          throw new FileOperationError(
            'Path is not a file',
            'NOT_A_FILE',
            { path }
          );
        }

        // Read content
        const encoding = options?.encoding || 'utf-8';
        const content = await fs.readFile(resolvedPath, encoding);

        const result: FileContent = {
          path: resolvedPath,
          type: this.detectFileType(resolvedPath),
          content
        };

        // Include metadata if requested
        if (options?.includeMetadata) {
          result.metadata = await this.getMetadata(resolvedPath);
        }

        return result;
      } catch (error) {
        throw this.handleFileError(error, 'read', path);
      }
    });
  }

  /**
   * Write a file
   */
  async write(path: string, content: string | Buffer, options?: WriteOptions): Promise<void> {
    return this.security.executeOperation('write', path, async () => {
      const resolvedPath = this.security.resolvePath(path);

      try {
        // Create backup if file exists and backup is enabled
        if (options?.createBackup && existsSync(resolvedPath)) {
          await this.createBackup(resolvedPath);
        }

        // Check if file exists and overwrite is not allowed
        if (!options?.overwrite && existsSync(resolvedPath)) {
          throw new FileOperationError(
            'File already exists',
            'FILE_EXISTS',
            { path }
          );
        }

        // Ensure directory exists
        await fs.mkdir(dirname(resolvedPath), { recursive: true });

        // Write file
        const encoding = options?.encoding || 'utf-8';
        if (Buffer.isBuffer(content)) {
          await fs.writeFile(resolvedPath, content);
        } else {
          await fs.writeFile(resolvedPath, content, encoding);
        }
      } catch (error) {
        throw this.handleFileError(error, 'write', path);
      }
    });
  }

  /**
   * Delete a file
   */
  async delete(path: string, createBackup = true): Promise<void> {
    return this.security.executeOperation('delete', path, async () => {
      const resolvedPath = this.security.resolvePath(path);

      try {
        // Create backup before deleting
        if (createBackup && existsSync(resolvedPath)) {
          await this.createBackup(resolvedPath);
        }

        await fs.unlink(resolvedPath);
      } catch (error) {
        throw this.handleFileError(error, 'delete', path);
      }
    });
  }

  /**
   * Rename a file
   */
  async rename(oldPath: string, newPath: string): Promise<void> {
    return this.security.executeOperation('rename', oldPath, async () => {
      const resolvedOldPath = this.security.resolvePath(oldPath);
      const resolvedNewPath = this.security.resolvePath(newPath);

      // Validate new path is also in sandbox
      if (!this.security.validatePath(newPath)) {
        throw new FileOperationError(
          'Destination path is outside sandbox',
          'PATH_OUTSIDE_SANDBOX',
          { oldPath, newPath }
        );
      }

      try {
        await fs.rename(resolvedOldPath, resolvedNewPath);
      } catch (error) {
        throw this.handleFileError(error, 'rename', oldPath);
      }
    });
  }

  /**
   * Move a file
   */
  async move(source: string, destination: string): Promise<void> {
    return this.security.executeOperation('move', source, async () => {
      const resolvedSource = this.security.resolvePath(source);
      const resolvedDest = this.security.resolvePath(destination);

      // Validate destination is in sandbox
      if (!this.security.validatePath(destination)) {
        throw new FileOperationError(
          'Destination path is outside sandbox',
          'PATH_OUTSIDE_SANDBOX',
          { source, destination }
        );
      }

      try {
        // Ensure destination directory exists
        await fs.mkdir(dirname(resolvedDest), { recursive: true });
        await fs.rename(resolvedSource, resolvedDest);
      } catch (error) {
        throw this.handleFileError(error, 'move', source);
      }
    });
  }

  /**
   * Copy a file
   */
  async copy(source: string, destination: string): Promise<void> {
    return this.security.executeOperation('copy', source, async () => {
      const resolvedSource = this.security.resolvePath(source);
      const resolvedDest = this.security.resolvePath(destination);

      // Validate destination is in sandbox
      if (!this.security.validatePath(destination)) {
        throw new FileOperationError(
          'Destination path is outside sandbox',
          'PATH_OUTSIDE_SANDBOX',
          { source, destination }
        );
      }

      try {
        // Ensure destination directory exists
        await fs.mkdir(dirname(resolvedDest), { recursive: true });
        await fs.copyFile(resolvedSource, resolvedDest);
      } catch (error) {
        throw this.handleFileError(error, 'copy', source);
      }
    });
  }

  /**
   * List directory contents
   */
  async listDirectory(path: string): Promise<FileMetadata[]> {
    return this.security.executeOperation('read', path, async () => {
      const resolvedPath = this.security.resolvePath(path);

      try {
        const entries = await fs.readdir(resolvedPath, { withFileTypes: true });
        const metadata: FileMetadata[] = [];

        for (const entry of entries) {
          const fullPath = join(resolvedPath, entry.name);
          if (entry.isFile()) {
            metadata.push(await this.getMetadata(fullPath));
          }
        }

        return metadata;
      } catch (error) {
        throw this.handleFileError(error, 'read', path);
      }
    });
  }

  /**
   * Get file metadata
   */
  async getMetadata(path: string): Promise<FileMetadata> {
    const resolvedPath = this.security.resolvePath(path);

    try {
      const stats = await fs.stat(resolvedPath);
      const checksum = await this.calculateChecksum(resolvedPath);

      return {
        id: nanoid(),
        path: resolvedPath,
        name: basename(resolvedPath),
        type: this.detectFileType(resolvedPath),
        size: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        checksum,
        mimeType: this.getMimeType(resolvedPath)
      };
    } catch (error) {
      throw this.handleFileError(error, 'read', path);
    }
  }

  /**
   * Create a backup of a file
   */
  async createBackup(path: string): Promise<string> {
    const resolvedPath = this.security.resolvePath(path);
    const fileName = basename(resolvedPath);
    const timestamp = Date.now();
    const backupName = `${timestamp}_${fileName}`;
    const backupPath = join(this.backupDir, backupName);

    await fs.copyFile(resolvedPath, backupPath);
    console.log(`[FileSystem] Backup created: ${backupPath}`);

    return backupPath;
  }

  /**
   * Detect file type from extension
   */
  private detectFileType(path: string): FileType {
    const ext = extname(path).toLowerCase();

    if (['.pdf'].includes(ext)) return 'pdf';
    if (['.xlsx', '.xls'].includes(ext)) return 'excel';
    if (['.csv'].includes(ext)) return 'csv';
    if (['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'].includes(ext)) return 'image';
    if (['.doc', '.docx', '.txt', '.rtf', '.md'].includes(ext)) return 'document';
    if (['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c'].includes(ext)) return 'code';
    if (['.zip', '.tar', '.gz', '.rar', '.7z'].includes(ext)) return 'archive';

    return 'unknown';
  }

  /**
   * Get MIME type
   */
  private getMimeType(path: string): string {
    const ext = extname(path).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.xls': 'application/vnd.ms-excel',
      '.csv': 'text/csv',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.txt': 'text/plain',
      '.json': 'application/json',
      '.js': 'application/javascript',
      '.ts': 'application/typescript'
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Calculate file checksum (SHA-256)
   */
  private async calculateChecksum(path: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash('sha256');
      const stream = createReadStream(path);

      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Handle file system errors
   */
  private handleFileError(error: unknown, operation: string, path: string): Error {
    if (error instanceof Error) {
      const code = (error as any).code;

      if (code === 'ENOENT') {
        return new FileOperationError(
          'File or directory not found',
          'FILE_NOT_FOUND',
          { operation, path }
        );
      }

      if (code === 'EACCES' || code === 'EPERM') {
        return new FileOperationError(
          'Permission denied',
          'PERMISSION_DENIED',
          { operation, path }
        );
      }

      if (code === 'EEXIST') {
        return new FileOperationError(
          'File already exists',
          'FILE_EXISTS',
          { operation, path }
        );
      }

      return new FileOperationError(
        error.message,
        'FILE_SYSTEM_ERROR',
        { operation, path }
      );
    }

    return new FileOperationError(
      'Unknown file system error',
      'UNKNOWN_ERROR',
      { operation, path }
    );
  }
}
