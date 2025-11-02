/**
 * SQLite database manager for Intelligent Finder
 */

import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Logger } from '../shared/utils/logger';

export class DatabaseManager {
  private db: Database.Database;
  private logger: Logger;

  constructor(private dbPath: string) {
    this.logger = new Logger('DatabaseManager');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initialize();
  }

  private initialize(): void {
    try {
      const schemaPath = join(__dirname, 'schemas', 'schema.sql');
      const schema = readFileSync(schemaPath, 'utf-8');
      this.db.exec(schema);
      this.logger.info('Database initialized successfully', { path: this.dbPath });
    } catch (error) {
      this.logger.error('Failed to initialize database', error as Error);
      throw error;
    }
  }

  getDb(): Database.Database {
    return this.db;
  }

  close(): void {
    this.db.close();
    this.logger.info('Database connection closed');
  }

  // Transaction helper
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  // Prepared statement helpers
  prepare(sql: string): Database.Statement {
    return this.db.prepare(sql);
  }

  // Backup database
  backup(destination: string): void {
    this.db.backup(destination);
    this.logger.info('Database backed up', { destination });
  }

  // Optimize database
  optimize(): void {
    this.db.pragma('optimize');
    this.db.exec('VACUUM');
    this.logger.info('Database optimized');
  }
}
