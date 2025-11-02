/**
 * Audit logging service for tracking all file operations
 */

import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../../shared/utils/logger';
import { AuditLogEntry, FileOperationType } from '../../shared/types';
import { DatabaseManager } from '../../database/Database';

export class AuditService {
  private logger: Logger;
  private db: DatabaseManager;

  constructor(db: DatabaseManager) {
    this.logger = new Logger('AuditService');
    this.db = db;
  }

  /**
   * Log file operation
   */
  async logOperation(
    operation: FileOperationType,
    filePath: string,
    details: Record<string, any>,
    result: 'success' | 'failure',
    duration: number,
    userId?: string,
    error?: string
  ): Promise<AuditLogEntry> {
    const entry: AuditLogEntry = {
      id: uuidv4(),
      timestamp: new Date(),
      operation,
      userId,
      filePath,
      details,
      result,
      error,
      duration
    };

    this.storeAuditLog(entry);

    this.logger.debug('Operation logged', {
      auditId: entry.id,
      operation,
      result,
      duration
    });

    return entry;
  }

  /**
   * Get audit logs with filtering
   */
  async getLogs(filters?: {
    operation?: FileOperationType;
    userId?: string;
    filePath?: string;
    result?: 'success' | 'failure';
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ entries: AuditLogEntry[]; total: number }> {
    let sql = 'SELECT * FROM audit_logs WHERE 1=1';
    const params: any[] = [];

    if (filters?.operation) {
      sql += ' AND operation = ?';
      params.push(filters.operation);
    }

    if (filters?.userId) {
      sql += ' AND user_id = ?';
      params.push(filters.userId);
    }

    if (filters?.filePath) {
      sql += ' AND file_path LIKE ?';
      params.push(`%${filters.filePath}%`);
    }

    if (filters?.result) {
      sql += ' AND result = ?';
      params.push(filters.result);
    }

    if (filters?.startDate) {
      sql += ' AND timestamp >= ?';
      params.push(filters.startDate.toISOString());
    }

    if (filters?.endDate) {
      sql += ' AND timestamp <= ?';
      params.push(filters.endDate.toISOString());
    }

    // Get total count
    const countStmt = this.db.prepare(sql.replace('*', 'COUNT(*) as total'));
    const countRow = countStmt.get(...params) as any;
    const total = countRow.total;

    // Get entries
    sql += ' ORDER BY timestamp DESC';

    if (filters?.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }

    if (filters?.offset) {
      sql += ' OFFSET ?';
      params.push(filters.offset);
    }

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as any[];

    const entries: AuditLogEntry[] = rows.map(row => ({
      id: row.id,
      timestamp: new Date(row.timestamp),
      operation: row.operation,
      userId: row.user_id,
      filePath: row.file_path,
      details: JSON.parse(row.details),
      result: row.result,
      error: row.error,
      duration: row.duration
    }));

    return { entries, total };
  }

  /**
   * Get operation statistics
   */
  async getStatistics(filters?: {
    startDate?: Date;
    endDate?: Date;
    userId?: string;
  }): Promise<{
    totalOperations: number;
    successRate: number;
    averageDuration: number;
    operationBreakdown: Record<FileOperationType, number>;
    errorBreakdown: Record<string, number>;
  }> {
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (filters?.startDate) {
      whereClause += ' AND timestamp >= ?';
      params.push(filters.startDate.toISOString());
    }

    if (filters?.endDate) {
      whereClause += ' AND timestamp <= ?';
      params.push(filters.endDate.toISOString());
    }

    if (filters?.userId) {
      whereClause += ' AND user_id = ?';
      params.push(filters.userId);
    }

    // Total operations and success rate
    const totalStmt = this.db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN result = 'success' THEN 1 ELSE 0 END) as successes,
        AVG(duration) as avg_duration
      FROM audit_logs
      ${whereClause}
    `);

    const totalRow = totalStmt.get(...params) as any;

    // Operation breakdown
    const operationStmt = this.db.prepare(`
      SELECT operation, COUNT(*) as count
      FROM audit_logs
      ${whereClause}
      GROUP BY operation
    `);

    const operationRows = operationStmt.all(...params) as any[];
    const operationBreakdown: Record<FileOperationType, number> = {} as any;

    operationRows.forEach(row => {
      operationBreakdown[row.operation as FileOperationType] = row.count;
    });

    // Error breakdown
    const errorStmt = this.db.prepare(`
      SELECT error, COUNT(*) as count
      FROM audit_logs
      ${whereClause} AND result = 'failure' AND error IS NOT NULL
      GROUP BY error
    `);

    const errorRows = errorStmt.all(...params) as any[];
    const errorBreakdown: Record<string, number> = {};

    errorRows.forEach(row => {
      errorBreakdown[row.error] = row.count;
    });

    return {
      totalOperations: totalRow.total || 0,
      successRate: totalRow.total > 0
        ? (totalRow.successes / totalRow.total) * 100
        : 0,
      averageDuration: totalRow.avg_duration || 0,
      operationBreakdown,
      errorBreakdown
    };
  }

  /**
   * Export audit logs to file
   */
  async exportLogs(
    outputPath: string,
    format: 'json' | 'csv',
    filters?: Parameters<typeof this.getLogs>[0]
  ): Promise<void> {
    const { entries } = await this.getLogs({ ...filters, limit: 100000 });

    if (format === 'json') {
      const fs = await import('fs/promises');
      await fs.writeFile(outputPath, JSON.stringify(entries, null, 2));
    } else {
      const { stringify } = await import('csv-stringify/sync');
      const csv = stringify(
        entries.map(e => ({
          ...e,
          details: JSON.stringify(e.details),
          timestamp: e.timestamp.toISOString()
        })),
        { header: true }
      );

      const fs = await import('fs/promises');
      await fs.writeFile(outputPath, csv);
    }

    this.logger.info('Audit logs exported', {
      outputPath,
      format,
      count: entries.length
    });
  }

  /**
   * Clean old audit logs
   */
  async cleanOldLogs(daysToKeep: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const stmt = this.db.prepare(`
      DELETE FROM audit_logs
      WHERE timestamp < ?
    `);

    const result = stmt.run(cutoffDate.toISOString());
    const deleted = result.changes;

    this.logger.info('Old audit logs cleaned', {
      daysToKeep,
      deleted
    });

    return deleted;
  }

  /**
   * Store audit log in database
   */
  private storeAuditLog(entry: AuditLogEntry): void {
    const stmt = this.db.prepare(`
      INSERT INTO audit_logs
      (id, timestamp, operation, user_id, file_path, details, result, error, duration)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      entry.id,
      entry.timestamp.toISOString(),
      entry.operation,
      entry.userId || null,
      entry.filePath,
      JSON.stringify(entry.details),
      entry.result,
      entry.error || null,
      entry.duration
    );
  }
}
