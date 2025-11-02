/**
 * Operation history manager for undo/redo functionality
 * Tracks all file operations with ability to rollback
 */

import { DatabaseManager } from '../../../database/Database';
import { FileOperationType, UndoableOperation, HistoryEntry } from '../../../shared/types';
import { Logger } from '../../../shared/utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class OperationHistory {
  private logger: Logger;
  private db: DatabaseManager;
  private operationStack: HistoryEntry[] = [];
  private maxHistorySize: number = 100;

  constructor(db: DatabaseManager) {
    this.logger = new Logger('OperationHistory');
    this.db = db;
    this.initializeDatabase();
    this.loadHistory();
  }

  /**
   * Initialize database tables
   */
  private initializeDatabase(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS operation_history (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        description TEXT NOT NULL,
        state TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        details TEXT NOT NULL,
        can_undo INTEGER NOT NULL DEFAULT 1
      );

      CREATE INDEX IF NOT EXISTS idx_operation_timestamp ON operation_history(timestamp);
      CREATE INDEX IF NOT EXISTS idx_operation_state ON operation_history(state);
    `);
  }

  /**
   * Load history from database
   */
  private loadHistory(): void {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM operation_history
        ORDER BY timestamp DESC
        LIMIT ?
      `);

      const rows = stmt.all(this.maxHistorySize) as any[];
      this.logger.info('Loaded operation history', { count: rows.length });
    } catch (error) {
      this.logger.error('Failed to load history', error as Error);
    }
  }

  /**
   * Record an operation
   */
  recordOperation(operation: UndoableOperation): void {
    try {
      const entry: HistoryEntry = {
        operation,
        state: 'executed',
        timestamp: new Date()
      };

      // Add to stack
      this.operationStack.push(entry);

      // Trim stack if too large
      if (this.operationStack.length > this.maxHistorySize) {
        this.operationStack.shift();
      }

      // Store in database
      const stmt = this.db.prepare(`
        INSERT INTO operation_history
        (id, type, description, state, timestamp, details, can_undo)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        operation.id,
        operation.type,
        operation.description,
        entry.state,
        entry.timestamp.toISOString(),
        JSON.stringify({ operationId: operation.id }),
        1
      );

      this.logger.debug('Operation recorded', {
        id: operation.id,
        type: operation.type
      });
    } catch (error) {
      this.logger.error('Failed to record operation', error as Error);
    }
  }

  /**
   * Undo last operation
   */
  async undoLast(): Promise<boolean> {
    try {
      // Find last executed operation
      const lastEntry = this.operationStack
        .slice()
        .reverse()
        .find(entry => entry.state === 'executed');

      if (!lastEntry) {
        this.logger.warn('No operation to undo');
        return false;
      }

      // Execute undo
      await lastEntry.operation.undo();

      // Update state
      lastEntry.state = 'undone';

      // Update database
      const stmt = this.db.prepare(`
        UPDATE operation_history
        SET state = 'undone'
        WHERE id = ?
      `);

      stmt.run(lastEntry.operation.id);

      this.logger.info('Operation undone', {
        id: lastEntry.operation.id,
        type: lastEntry.operation.type
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to undo operation', error as Error);
      return false;
    }
  }

  /**
   * Redo last undone operation
   */
  async redoLast(): Promise<boolean> {
    try {
      // Find last undone operation
      const lastUndone = this.operationStack
        .slice()
        .reverse()
        .find(entry => entry.state === 'undone');

      if (!lastUndone) {
        this.logger.warn('No operation to redo');
        return false;
      }

      // Execute redo
      await lastUndone.operation.execute();

      // Update state
      lastUndone.state = 'executed';

      // Update database
      const stmt = this.db.prepare(`
        UPDATE operation_history
        SET state = 'executed'
        WHERE id = ?
      `);

      stmt.run(lastUndone.operation.id);

      this.logger.info('Operation redone', {
        id: lastUndone.operation.id,
        type: lastUndone.operation.type
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to redo operation', error as Error);
      return false;
    }
  }

  /**
   * Undo specific operation by ID
   */
  async undoOperation(operationId: string): Promise<boolean> {
    try {
      const entry = this.operationStack.find(
        e => e.operation.id === operationId && e.state === 'executed'
      );

      if (!entry) {
        this.logger.warn('Operation not found or already undone', { operationId });
        return false;
      }

      await entry.operation.undo();
      entry.state = 'undone';

      const stmt = this.db.prepare(`
        UPDATE operation_history
        SET state = 'undone'
        WHERE id = ?
      `);

      stmt.run(operationId);

      this.logger.info('Operation undone', { operationId });
      return true;
    } catch (error) {
      this.logger.error('Failed to undo operation', error as Error, { operationId });
      return false;
    }
  }

  /**
   * Get history entries
   */
  getHistory(limit: number = 50): HistoryEntry[] {
    return this.operationStack
      .slice()
      .reverse()
      .slice(0, limit);
  }

  /**
   * Get operation by ID
   */
  getOperation(operationId: string): HistoryEntry | null {
    return this.operationStack.find(e => e.operation.id === operationId) || null;
  }

  /**
   * Check if can undo
   */
  canUndo(): boolean {
    return this.operationStack.some(e => e.state === 'executed');
  }

  /**
   * Check if can redo
   */
  canRedo(): boolean {
    return this.operationStack.some(e => e.state === 'undone');
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    try {
      this.operationStack = [];
      this.db.exec('DELETE FROM operation_history');
      this.logger.info('History cleared');
    } catch (error) {
      this.logger.error('Failed to clear history', error as Error);
    }
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalOperations: number;
    executedCount: number;
    undoneCount: number;
    byType: Record<string, number>;
  } {
    const executed = this.operationStack.filter(e => e.state === 'executed').length;
    const undone = this.operationStack.filter(e => e.state === 'undone').length;

    const byType: Record<string, number> = {};
    this.operationStack.forEach(entry => {
      const type = entry.operation.type;
      byType[type] = (byType[type] || 0) + 1;
    });

    return {
      totalOperations: this.operationStack.length,
      executedCount: executed,
      undoneCount: undone,
      byType
    };
  }
}
