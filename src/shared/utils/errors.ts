/**
 * Custom error classes for Intelligent Finder
 */

export class FileServiceError extends Error {
  constructor(message: string, public code: string, public details?: any) {
    super(message);
    this.name = 'FileServiceError';
  }
}

export class ParserError extends Error {
  constructor(message: string, public fileType: string, public filePath: string) {
    super(message);
    this.name = 'ParserError';
  }
}

export class WorkflowError extends Error {
  constructor(message: string, public workflowId: string, public step?: string) {
    super(message);
    this.name = 'WorkflowError';
  }
}

export class ReportError extends Error {
  constructor(message: string, public format: string) {
    super(message);
    this.name = 'ReportError';
  }
}

export class BackupError extends Error {
  constructor(message: string, public operation: 'backup' | 'restore') {
    super(message);
    this.name = 'BackupError';
  }
}

export class QueueError extends Error {
  constructor(message: string, public operationId: string) {
    super(message);
    this.name = 'QueueError';
  }
}
