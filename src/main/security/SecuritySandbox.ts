/**
 * Security Sandbox - Enforces strict file system access control
 * All file operations must go through this sandbox
 */

import { normalize, resolve, relative, isAbsolute } from 'path';
import { SecurityError } from '@shared/types/ipc';
import { nanoid } from 'nanoid';

export interface SecurityConfig {
  rootDirectory: string;
  allowedOperations: OperationType[];
  backupEnabled: boolean;
  maxFileSize?: number; // bytes
  blockedExtensions?: string[];
  auditLog?: boolean;
}

export type OperationType = 'read' | 'write' | 'delete' | 'rename' | 'move' | 'copy';

export interface FileOperation {
  id: string;
  type: OperationType;
  path: string;
  timestamp: Date;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface AuditLogEntry {
  id: string;
  operation: FileOperation;
  success: boolean;
  error?: string;
  duration: number;
}

export class SecuritySandbox {
  private rootPath: string;
  private config: SecurityConfig;
  private auditLog: AuditLogEntry[] = [];
  private operationHistory: Map<string, FileOperation> = new Map();

  constructor(config: SecurityConfig) {
    this.config = config;
    this.rootPath = resolve(normalize(config.rootDirectory));

    console.log(`[Security] Sandbox initialized with root: ${this.rootPath}`);
  }

  /**
   * Validate if a path is within the sandbox
   */
  validatePath(targetPath: string): boolean {
    try {
      // Normalize and resolve the path
      const normalized = normalize(targetPath);
      const absolute = isAbsolute(normalized) ? normalized : resolve(this.rootPath, normalized);

      // Check if path is within root
      const rel = relative(this.rootPath, absolute);
      const isInside = !rel.startsWith('..') && !isAbsolute(rel);

      if (!isInside) {
        console.warn(`[Security] Path outside sandbox: ${targetPath}`);
      }

      return isInside;
    } catch (error) {
      console.error('[Security] Path validation error:', error);
      return false;
    }
  }

  /**
   * Validate file extension
   */
  validateExtension(path: string): boolean {
    if (!this.config.blockedExtensions || this.config.blockedExtensions.length === 0) {
      return true;
    }

    const ext = path.split('.').pop()?.toLowerCase();
    const isBlocked = ext && this.config.blockedExtensions.includes(ext);

    if (isBlocked) {
      console.warn(`[Security] Blocked extension: ${ext}`);
    }

    return !isBlocked;
  }

  /**
   * Check if operation type is allowed
   */
  isOperationAllowed(operation: OperationType): boolean {
    return this.config.allowedOperations.includes(operation);
  }

  /**
   * Resolve a path relative to sandbox root
   */
  resolvePath(path: string): string {
    const normalized = normalize(path);
    return isAbsolute(normalized) ? normalized : resolve(this.rootPath, normalized);
  }

  /**
   * Get the sandbox root path
   */
  getRootPath(): string {
    return this.rootPath;
  }

  /**
   * Set a new sandbox root (requires validation)
   */
  setRootPath(newRoot: string): void {
    const normalized = resolve(normalize(newRoot));
    this.rootPath = normalized;
    console.log(`[Security] Sandbox root updated to: ${this.rootPath}`);
  }

  /**
   * Execute an operation with security checks
   */
  async executeOperation<T>(
    operation: OperationType,
    path: string,
    executor: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    const operationId = nanoid();

    const op: FileOperation = {
      id: operationId,
      type: operation,
      path,
      timestamp: new Date()
    };

    // Security checks
    if (!this.isOperationAllowed(operation)) {
      const error = new SecurityError(
        `Operation '${operation}' is not allowed`,
        'OPERATION_NOT_ALLOWED',
        { operation, path }
      );
      this.logOperation(op, false, error.message, Date.now() - startTime);
      throw error;
    }

    if (!this.validatePath(path)) {
      const error = new SecurityError(
        'Path is outside sandbox boundaries',
        'PATH_OUTSIDE_SANDBOX',
        { path, root: this.rootPath }
      );
      this.logOperation(op, false, error.message, Date.now() - startTime);
      throw error;
    }

    if (!this.validateExtension(path)) {
      const error = new SecurityError(
        'File extension is blocked',
        'BLOCKED_EXTENSION',
        { path }
      );
      this.logOperation(op, false, error.message, Date.now() - startTime);
      throw error;
    }

    // Execute the operation
    try {
      this.operationHistory.set(operationId, op);
      const result = await executor();
      this.logOperation(op, true, undefined, Date.now() - startTime);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logOperation(op, false, message, Date.now() - startTime);
      throw error;
    }
  }

  /**
   * Log operation for audit trail
   */
  private logOperation(
    operation: FileOperation,
    success: boolean,
    error: string | undefined,
    duration: number
  ): void {
    if (!this.config.auditLog) return;

    const entry: AuditLogEntry = {
      id: nanoid(),
      operation,
      success,
      error,
      duration
    };

    this.auditLog.push(entry);

    // Keep only last 1000 entries
    if (this.auditLog.length > 1000) {
      this.auditLog.shift();
    }

    if (!success && error) {
      console.error(`[Security] Operation failed:`, {
        type: operation.type,
        path: operation.path,
        error
      });
    }
  }

  /**
   * Get audit log
   */
  getAuditLog(limit?: number): AuditLogEntry[] {
    if (!limit) return [...this.auditLog];
    return this.auditLog.slice(-limit);
  }

  /**
   * Get operation history
   */
  getOperationHistory(): FileOperation[] {
    return Array.from(this.operationHistory.values());
  }

  /**
   * Clear audit log
   */
  clearAuditLog(): void {
    this.auditLog = [];
    console.log('[Security] Audit log cleared');
  }

  /**
   * Get security statistics
   */
  getStatistics() {
    const total = this.auditLog.length;
    const successful = this.auditLog.filter(e => e.success).length;
    const failed = total - successful;

    const operationCounts = this.auditLog.reduce((acc, entry) => {
      const type = entry.operation.type;
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total,
      successful,
      failed,
      successRate: total > 0 ? (successful / total) * 100 : 0,
      operationCounts,
      rootPath: this.rootPath,
      allowedOperations: this.config.allowedOperations
    };
  }
}
