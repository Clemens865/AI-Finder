/**
 * Service Layer Integration
 * Main entry point for all business logic services
 */

import { DatabaseManager } from '../database/Database';
import { FileService } from './file-service/FileService';
import { WorkflowOrchestrator } from './workflow-service/WorkflowOrchestrator';
import { ReportGenerator } from './report-service/ReportGenerator';
import { BackupService } from './backup-service/BackupService';
import { OperationQueue } from './queue-service/OperationQueue';
import { AuditService } from './audit-service/AuditService';
import { Logger } from '../shared/utils/logger';

export interface ServiceManagerConfig {
  databasePath: string;
  backupDirectory: string;
  maxConcurrentOperations?: number;
}

/**
 * Central service manager for Intelligent Finder
 */
export class ServiceManager {
  private logger: Logger;
  private db: DatabaseManager;
  public fileService: FileService;
  public workflowService: WorkflowOrchestrator;
  public reportService: ReportGenerator;
  public backupService: BackupService;
  public queueService: OperationQueue;
  public auditService: AuditService;

  constructor(config: ServiceManagerConfig) {
    this.logger = new Logger('ServiceManager');

    // Initialize database
    this.db = new DatabaseManager(config.databasePath);

    // Initialize all services
    this.fileService = new FileService(this.db);
    this.reportService = new ReportGenerator();
    this.backupService = new BackupService(this.db, config.backupDirectory);
    this.queueService = new OperationQueue(
      this.db,
      config.maxConcurrentOperations || 5
    );
    this.auditService = new AuditService(this.db);
    this.workflowService = new WorkflowOrchestrator(this.db, this.fileService);

    // Wire up event handlers
    this.setupEventHandlers();

    this.logger.info('Service Manager initialized', {
      databasePath: config.databasePath,
      backupDirectory: config.backupDirectory
    });
  }

  /**
   * Setup event handlers for service coordination
   */
  private setupEventHandlers(): void {
    // Queue operation execution
    this.queueService.on('operation:execute', async (operation) => {
      try {
        // Execute operation based on type
        const result = await this.executeQueuedOperation(operation);

        // Log to audit
        await this.auditService.logOperation(
          operation.type,
          operation.params.path || 'unknown',
          operation.params,
          'success',
          Date.now() - operation.startedAt!.getTime()
        );
      } catch (error) {
        await this.auditService.logOperation(
          operation.type,
          operation.params.path || 'unknown',
          operation.params,
          'failure',
          Date.now() - operation.startedAt!.getTime(),
          undefined,
          (error as Error).message
        );
      }
    });

    // Log completed operations
    this.queueService.on('operation:completed', (operation) => {
      this.logger.info('Queue operation completed', {
        operationId: operation.id,
        type: operation.type
      });
    });

    // Log failed operations
    this.queueService.on('operation:failed', (operation) => {
      this.logger.error('Queue operation failed', new Error(operation.error!), {
        operationId: operation.id,
        type: operation.type
      });
    });
  }

  /**
   * Execute queued operation
   */
  private async executeQueuedOperation(operation: any): Promise<any> {
    const { type, params } = operation;

    switch (type) {
      case 'READ':
        return this.fileService.readFile(params.path);

      case 'WRITE':
        return this.fileService.writeFile(params.path, params.content);

      case 'PARSE':
        return this.fileService.parseFile(params.path);

      case 'COPY':
        return this.fileService.copyFile(params.source, params.destination);

      case 'DELETE':
        return this.fileService.deleteFile(params.path);

      case 'BACKUP':
        return this.backupService.createBackup(params.files, params.description);

      case 'RESTORE':
        return this.backupService.restoreBackup(params);

      default:
        throw new Error(`Unknown operation type: ${type}`);
    }
  }

  /**
   * Start the service manager
   */
  async start(): Promise<void> {
    this.queueService.start();
    this.logger.info('Service Manager started');
  }

  /**
   * Stop the service manager
   */
  async stop(): Promise<void> {
    this.queueService.stop();
    this.db.close();
    this.logger.info('Service Manager stopped');
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: Record<string, boolean>;
    queueStats: any;
  }> {
    const queueStats = await this.queueService.getStats();

    const services = {
      database: true,
      fileService: true,
      workflowService: true,
      reportService: true,
      backupService: true,
      queueService: this.queueService['running'],
      auditService: true
    };

    const allHealthy = Object.values(services).every(s => s);
    const status = allHealthy ? 'healthy' : 'degraded';

    return {
      status,
      services,
      queueStats
    };
  }
}

// Export all services and types
export * from './file-service/FileService';
export * from './workflow-service/WorkflowOrchestrator';
export * from './report-service/ReportGenerator';
export * from './backup-service/BackupService';
export * from './queue-service/OperationQueue';
export * from './audit-service/AuditService';
export * from '../shared/types';
export * from '../shared/utils/errors';
export * from '../shared/utils/logger';
