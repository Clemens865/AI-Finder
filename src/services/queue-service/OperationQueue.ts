/**
 * Operation queue service for async file processing
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../../shared/utils/logger';
import { QueueError } from '../../shared/utils/errors';
import { QueuedOperation, FileOperationType } from '../../shared/types';
import { DatabaseManager } from '../../database/Database';

export class OperationQueue extends EventEmitter {
  private logger: Logger;
  private db: DatabaseManager;
  private processing: Map<string, QueuedOperation>;
  private maxConcurrent: number;
  private running: boolean;

  constructor(db: DatabaseManager, maxConcurrent: number = 5) {
    super();
    this.logger = new Logger('OperationQueue');
    this.db = db;
    this.processing = new Map();
    this.maxConcurrent = maxConcurrent;
    this.running = false;
  }

  /**
   * Add operation to queue
   */
  async enqueue(
    type: FileOperationType,
    params: Record<string, any>,
    priority: 'low' | 'normal' | 'high' | 'critical' = 'normal'
  ): Promise<string> {
    const operation: QueuedOperation = {
      id: uuidv4(),
      type,
      priority,
      params,
      status: 'pending',
      attempts: 0,
      createdAt: new Date()
    };

    // Store in database
    this.storeOperation(operation);

    this.logger.info('Operation enqueued', {
      operationId: operation.id,
      type,
      priority
    });

    // Start processing if not running
    if (!this.running) {
      this.start();
    }

    return operation.id;
  }

  /**
   * Start processing queue
   */
  start(): void {
    if (this.running) return;

    this.running = true;
    this.logger.info('Queue processing started');
    this.processQueue();
  }

  /**
   * Stop processing queue
   */
  stop(): void {
    this.running = false;
    this.logger.info('Queue processing stopped');
  }

  /**
   * Process operations in queue
   */
  private async processQueue(): Promise<void> {
    while (this.running) {
      // Check if we can process more operations
      if (this.processing.size >= this.maxConcurrent) {
        await this.sleep(100);
        continue;
      }

      // Get next operation from queue
      const operation = await this.getNextOperation();
      if (!operation) {
        await this.sleep(1000);
        continue;
      }

      // Process operation
      this.processOperation(operation).catch(error => {
        this.logger.error('Failed to process operation', error, {
          operationId: operation.id
        });
      });
    }
  }

  /**
   * Process a single operation
   */
  private async processOperation(operation: QueuedOperation): Promise<void> {
    this.processing.set(operation.id, operation);
    operation.status = 'processing';
    operation.startedAt = new Date();
    operation.attempts++;

    this.updateOperation(operation);

    this.logger.info('Processing operation', {
      operationId: operation.id,
      type: operation.type,
      attempt: operation.attempts
    });

    try {
      // Execute operation (to be implemented based on operation type)
      await this.executeOperation(operation);

      operation.status = 'completed';
      operation.completedAt = new Date();
      this.updateOperation(operation);

      this.emit('operation:completed', operation);
      this.logger.info('Operation completed', { operationId: operation.id });
    } catch (error) {
      operation.error = (error as Error).message;

      // Retry logic
      if (operation.attempts < 3) {
        operation.status = 'pending';
        this.logger.warn('Operation failed, will retry', {
          operationId: operation.id,
          attempt: operation.attempts,
          error: operation.error
        });
      } else {
        operation.status = 'failed';
        this.emit('operation:failed', operation);
        this.logger.error('Operation failed permanently', error as Error, {
          operationId: operation.id
        });
      }

      this.updateOperation(operation);
    } finally {
      this.processing.delete(operation.id);
    }
  }

  /**
   * Execute operation based on type
   */
  private async executeOperation(operation: QueuedOperation): Promise<void> {
    // This is a placeholder - actual implementation would delegate to appropriate services
    switch (operation.type) {
      case FileOperationType.READ:
      case FileOperationType.WRITE:
      case FileOperationType.PARSE:
      case FileOperationType.COPY:
      case FileOperationType.MOVE:
      case FileOperationType.DELETE:
        // Delegate to FileService
        this.emit('operation:execute', operation);
        break;

      case FileOperationType.BACKUP:
      case FileOperationType.RESTORE:
        // Delegate to BackupService
        this.emit('operation:execute', operation);
        break;

      default:
        throw new QueueError(
          `Unknown operation type: ${operation.type}`,
          operation.id
        );
    }

    // Simulate async work
    await this.sleep(100);
  }

  /**
   * Get next operation from queue (priority-based)
   */
  private async getNextOperation(): Promise<QueuedOperation | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM operation_queue
      WHERE status = 'pending'
      ORDER BY
        CASE priority
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'normal' THEN 3
          WHEN 'low' THEN 4
        END,
        created_at ASC
      LIMIT 1
    `);

    const row = stmt.get() as any;
    if (!row) return null;

    return {
      id: row.id,
      type: row.type,
      priority: row.priority,
      params: JSON.parse(row.params),
      status: row.status,
      attempts: row.attempts,
      createdAt: new Date(row.created_at),
      startedAt: row.started_at ? new Date(row.started_at) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      error: row.error
    };
  }

  /**
   * Get operation status
   */
  async getStatus(operationId: string): Promise<QueuedOperation | null> {
    const stmt = this.db.prepare('SELECT * FROM operation_queue WHERE id = ?');
    const row = stmt.get(operationId) as any;

    if (!row) return null;

    return {
      id: row.id,
      type: row.type,
      priority: row.priority,
      params: JSON.parse(row.params),
      status: row.status,
      attempts: row.attempts,
      createdAt: new Date(row.created_at),
      startedAt: row.started_at ? new Date(row.started_at) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      error: row.error
    };
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    const stmt = this.db.prepare(`
      SELECT
        status,
        COUNT(*) as count
      FROM operation_queue
      GROUP BY status
    `);

    const rows = stmt.all() as any[];
    const stats = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0
    };

    rows.forEach(row => {
      stats[row.status as keyof typeof stats] = row.count;
    });

    return stats;
  }

  /**
   * Cancel pending operation
   */
  async cancel(operationId: string): Promise<boolean> {
    const operation = await this.getStatus(operationId);
    if (!operation || operation.status !== 'pending') {
      return false;
    }

    const stmt = this.db.prepare(
      'DELETE FROM operation_queue WHERE id = ? AND status = ?'
    );

    const result = stmt.run(operationId, 'pending');
    const cancelled = result.changes > 0;

    if (cancelled) {
      this.logger.info('Operation cancelled', { operationId });
      this.emit('operation:cancelled', operation);
    }

    return cancelled;
  }

  /**
   * Clear completed operations
   */
  async clearCompleted(): Promise<number> {
    const stmt = this.db.prepare(
      "DELETE FROM operation_queue WHERE status IN ('completed', 'failed')"
    );

    const result = stmt.run();
    this.logger.info('Completed operations cleared', { count: result.changes });

    return result.changes;
  }

  /**
   * Store operation in database
   */
  private storeOperation(operation: QueuedOperation): void {
    const stmt = this.db.prepare(`
      INSERT INTO operation_queue
      (id, type, priority, params, status, attempts, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      operation.id,
      operation.type,
      operation.priority,
      JSON.stringify(operation.params),
      operation.status,
      operation.attempts,
      operation.createdAt.toISOString()
    );
  }

  /**
   * Update operation in database
   */
  private updateOperation(operation: QueuedOperation): void {
    const stmt = this.db.prepare(`
      UPDATE operation_queue
      SET status = ?, attempts = ?, started_at = ?, completed_at = ?, error = ?
      WHERE id = ?
    `);

    stmt.run(
      operation.status,
      operation.attempts,
      operation.startedAt?.toISOString() || null,
      operation.completedAt?.toISOString() || null,
      operation.error || null,
      operation.id
    );
  }

  /**
   * Helper to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
