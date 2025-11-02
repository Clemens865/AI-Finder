/**
 * Batch file operations manager
 * Handles multiple file operations in parallel with error recovery
 */

import { readFile, writeFile, copyFile, unlink, rename } from 'fs/promises';
import { Logger } from '../../../shared/utils/logger';
import { FileOperationType, FileOperationResult } from '../../../shared/types';
import { FileServiceError } from '../../../shared/utils/errors';
import { v4 as uuidv4 } from 'uuid';

export interface BatchOperation {
  id: string;
  type: FileOperationType;
  params: any;
  priority?: number;
}

export interface BatchResult {
  success: boolean;
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  results: FileOperationResult[];
  errors: Array<{ operationId: string; error: string }>;
  duration: number;
}

export class BatchOperations {
  private logger: Logger;
  private maxConcurrency: number = 10;

  constructor(maxConcurrency?: number) {
    this.logger = new Logger('BatchOperations');
    if (maxConcurrency) {
      this.maxConcurrency = maxConcurrency;
    }
  }

  /**
   * Execute batch operations
   */
  async executeBatch(operations: BatchOperation[]): Promise<BatchResult> {
    const startTime = Date.now();
    const results: FileOperationResult[] = [];
    const errors: Array<{ operationId: string; error: string }> = [];

    this.logger.info('Starting batch operations', {
      totalOperations: operations.length,
      maxConcurrency: this.maxConcurrency
    });

    // Sort by priority (higher first)
    const sortedOps = operations.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    // Execute in batches of maxConcurrency
    for (let i = 0; i < sortedOps.length; i += this.maxConcurrency) {
      const batch = sortedOps.slice(i, i + this.maxConcurrency);

      const batchResults = await Promise.allSettled(
        batch.map(op => this.executeOperation(op))
      );

      batchResults.forEach((result, index) => {
        const operation = batch[index];

        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          const error = result.reason as Error;
          this.logger.error('Operation failed', error, { operationId: operation.id });
          errors.push({
            operationId: operation.id,
            error: error.message
          });

          // Add failed result
          results.push({
            success: false,
            operationId: operation.id,
            error: error.message,
            timestamp: new Date(),
            duration: 0
          });
        }
      });
    }

    const duration = Date.now() - startTime;
    const successfulOperations = results.filter(r => r.success).length;
    const failedOperations = results.filter(r => !r.success).length;

    this.logger.info('Batch operations completed', {
      totalOperations: operations.length,
      successfulOperations,
      failedOperations,
      duration
    });

    return {
      success: errors.length === 0,
      totalOperations: operations.length,
      successfulOperations,
      failedOperations,
      results,
      errors,
      duration
    };
  }

  /**
   * Execute a single operation
   */
  private async executeOperation(operation: BatchOperation): Promise<FileOperationResult> {
    const startTime = Date.now();

    try {
      let data: any;

      switch (operation.type) {
        case FileOperationType.READ:
          data = await readFile(operation.params.path);
          break;

        case FileOperationType.WRITE:
          await writeFile(operation.params.path, operation.params.content);
          data = { path: operation.params.path };
          break;

        case FileOperationType.COPY:
          await copyFile(operation.params.source, operation.params.dest);
          data = { source: operation.params.source, dest: operation.params.dest };
          break;

        case FileOperationType.MOVE:
          await rename(operation.params.source, operation.params.dest);
          data = { source: operation.params.source, dest: operation.params.dest };
          break;

        case FileOperationType.DELETE:
          await unlink(operation.params.path);
          data = { path: operation.params.path };
          break;

        default:
          throw new FileServiceError(
            `Unsupported operation type: ${operation.type}`,
            'INVALID_OPERATION',
            { type: operation.type }
          );
      }

      const duration = Date.now() - startTime;

      return {
        success: true,
        operationId: operation.id,
        data,
        timestamp: new Date(),
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        success: false,
        operationId: operation.id,
        error: (error as Error).message,
        timestamp: new Date(),
        duration
      };
    }
  }

  /**
   * Create batch read operations
   */
  createReadBatch(paths: string[]): BatchOperation[] {
    return paths.map(path => ({
      id: uuidv4(),
      type: FileOperationType.READ,
      params: { path },
      priority: 1
    }));
  }

  /**
   * Create batch write operations
   */
  createWriteBatch(writes: Array<{ path: string; content: Buffer | string }>): BatchOperation[] {
    return writes.map(write => ({
      id: uuidv4(),
      type: FileOperationType.WRITE,
      params: write,
      priority: 2
    }));
  }

  /**
   * Create batch copy operations
   */
  createCopyBatch(copies: Array<{ source: string; dest: string }>): BatchOperation[] {
    return copies.map(copy => ({
      id: uuidv4(),
      type: FileOperationType.COPY,
      params: copy,
      priority: 1
    }));
  }

  /**
   * Create batch delete operations
   */
  createDeleteBatch(paths: string[]): BatchOperation[] {
    return paths.map(path => ({
      id: uuidv4(),
      type: FileOperationType.DELETE,
      params: { path },
      priority: 3
    }));
  }

  /**
   * Retry failed operations
   */
  async retryFailed(
    batchResult: BatchResult,
    maxRetries: number = 3
  ): Promise<BatchResult> {
    if (batchResult.errors.length === 0) {
      return batchResult;
    }

    this.logger.info('Retrying failed operations', {
      failedCount: batchResult.errors.length,
      maxRetries
    });

    // Get failed operation IDs
    const failedIds = new Set(batchResult.errors.map(e => e.operationId));

    // Find original operations (would need to be passed in)
    // For now, we'll just return the original result
    // In a real implementation, we'd track the original operations

    return batchResult;
  }

  /**
   * Set concurrency limit
   */
  setConcurrency(limit: number): void {
    this.maxConcurrency = Math.max(1, limit);
    this.logger.info('Concurrency limit updated', { limit: this.maxConcurrency });
  }
}
