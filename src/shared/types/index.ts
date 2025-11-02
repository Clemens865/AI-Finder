/**
 * Core type definitions for Intelligent Finder
 */

// File operation types
export enum FileOperationType {
  READ = 'READ',
  WRITE = 'WRITE',
  PARSE = 'PARSE',
  SEARCH = 'SEARCH',
  COPY = 'COPY',
  MOVE = 'MOVE',
  DELETE = 'DELETE',
  BACKUP = 'BACKUP',
  RESTORE = 'RESTORE'
}

// File types supported by parsers
export enum SupportedFileType {
  PDF = 'PDF',
  EXCEL = 'EXCEL',
  CSV = 'CSV',
  IMAGE = 'IMAGE',
  TEXT = 'TEXT',
  JSON = 'JSON',
  XML = 'XML'
}

// Base file metadata interface
export interface FileMetadata {
  id: string;
  path: string;
  name: string;
  extension: string;
  size: number;
  created: Date;
  modified: Date;
  accessed: Date;
  mimeType: string;
  encoding?: string;
  checksum?: string;
}

// Parsed file content
export interface ParsedContent {
  fileId: string;
  type: SupportedFileType;
  content: string | Buffer;
  metadata: Record<string, any>;
  extractedText?: string;
  pages?: number;
  sheets?: string[];
  imageData?: {
    width: number;
    height: number;
    format: string;
  };
}

// File operation result
export interface FileOperationResult<T = any> {
  success: boolean;
  operationId: string;
  data?: T;
  error?: string;
  timestamp: Date;
  duration: number;
}

// Workflow definition
export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  timeout?: number;
  retryPolicy?: RetryPolicy;
}

export interface WorkflowStep {
  id: string;
  type: 'file-operation' | 'parse' | 'transform' | 'report' | 'custom';
  operation: string;
  params: Record<string, any>;
  dependencies?: string[];
  continueOnError?: boolean;
}

export interface RetryPolicy {
  maxAttempts: number;
  delayMs: number;
  backoffMultiplier?: number;
}

// Workflow execution context
export interface WorkflowContext {
  workflowId: string;
  executionId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  currentStep?: string;
  results: Map<string, any>;
  errors: Error[];
  startTime: Date;
  endTime?: Date;
}

// Report generation options
export interface ReportOptions {
  format: 'excel' | 'pdf' | 'csv';
  title: string;
  data: any[];
  columns?: ReportColumn[];
  styles?: ReportStyles;
  output: string;
}

export interface ReportColumn {
  key: string;
  header: string;
  width?: number;
  type?: 'string' | 'number' | 'date' | 'boolean';
  format?: string;
}

export interface ReportStyles {
  headerBgColor?: string;
  headerFontColor?: string;
  fontSize?: number;
  fontFamily?: string;
  alternateRowColor?: boolean;
}

// Backup and restore
export interface BackupMetadata {
  id: string;
  timestamp: Date;
  files: string[];
  size: number;
  checksum: string;
  description?: string;
}

export interface RestoreOptions {
  backupId: string;
  targetPath?: string;
  overwrite?: boolean;
  validateChecksum?: boolean;
}

// Operation queue
export interface QueuedOperation {
  id: string;
  type: FileOperationType;
  priority: 'low' | 'normal' | 'high' | 'critical';
  params: Record<string, any>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

// Audit trail
export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  operation: FileOperationType;
  userId?: string;
  filePath: string;
  details: Record<string, any>;
  result: 'success' | 'failure';
  error?: string;
  duration: number;
}

// Search and indexing
export interface SearchQuery {
  query: string;
  fileTypes?: SupportedFileType[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  sizeRange?: {
    min: number;
    max: number;
  };
  path?: string;
  metadata?: Record<string, any>;
}

export interface SearchResult {
  files: FileMetadata[];
  total: number;
  page: number;
  pageSize: number;
  facets?: Record<string, number>;
}

// Undo/Redo system
export interface UndoableOperation {
  id: string;
  type: FileOperationType;
  execute: () => Promise<void>;
  undo: () => Promise<void>;
  timestamp: Date;
  description: string;
}

export interface HistoryEntry {
  operation: UndoableOperation;
  state: 'executed' | 'undone';
  timestamp: Date;
}
