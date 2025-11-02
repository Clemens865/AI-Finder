/**
 * IPC Communication Types
 * Defines the contract between main and renderer processes
 */

// File System Operations
export interface FileReadOptions {
  encoding?: BufferEncoding;
  parseContent?: boolean;
  includeMetadata?: boolean;
}

export interface FileContent {
  path: string;
  type: FileType;
  content: string | Buffer;
  parsed?: ParsedContent;
  metadata?: FileMetadata;
}

export interface FileMetadata {
  id: string;
  path: string;
  name: string;
  type: FileType;
  size: number;
  createdAt: Date;
  modifiedAt: Date;
  checksum: string;
  mimeType: string;
}

export interface WriteOptions {
  encoding?: BufferEncoding;
  createBackup?: boolean;
  overwrite?: boolean;
}

export type FileType = 'pdf' | 'excel' | 'csv' | 'image' | 'document' | 'code' | 'archive' | 'unknown';

export interface ParsedContent {
  type: string;
  data: Record<string, any>;
  text?: string;
}

// File System Watch
export interface WatchEvent {
  type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';
  path: string;
  stats?: FileMetadata;
}

export type WatchCallback = (event: WatchEvent) => void;

// IPC Channel Names
export const IPC_CHANNELS = {
  // File Operations
  FILE_READ: 'file:read',
  FILE_WRITE: 'file:write',
  FILE_DELETE: 'file:delete',
  FILE_RENAME: 'file:rename',
  FILE_MOVE: 'file:move',
  FILE_COPY: 'file:copy',
  FILE_LIST_DIR: 'file:listDir',
  FILE_METADATA: 'file:metadata',

  // File System Watch
  FILE_WATCH_START: 'file:watch:start',
  FILE_WATCH_STOP: 'file:watch:stop',
  FILE_WATCH_EVENT: 'file:watch:event',

  // Security
  SECURITY_VALIDATE_PATH: 'security:validatePath',
  SECURITY_GET_ROOT: 'security:getRoot',
  SECURITY_SET_ROOT: 'security:setRoot',

  // Backup/Undo
  BACKUP_CREATE: 'backup:create',
  BACKUP_RESTORE: 'backup:restore',
  OPERATION_UNDO: 'operation:undo',

  // System
  SYSTEM_GET_PATH: 'system:getPath',
  SYSTEM_OPEN_DIALOG: 'system:openDialog',
  SYSTEM_SAVE_DIALOG: 'system:saveDialog'
} as const;

// IPC Handler Types
export interface IPCHandlers {
  // File Operations
  [IPC_CHANNELS.FILE_READ]: (path: string, options?: FileReadOptions) => Promise<FileContent>;
  [IPC_CHANNELS.FILE_WRITE]: (path: string, content: string | Buffer, options?: WriteOptions) => Promise<void>;
  [IPC_CHANNELS.FILE_DELETE]: (path: string) => Promise<void>;
  [IPC_CHANNELS.FILE_RENAME]: (oldPath: string, newPath: string) => Promise<void>;
  [IPC_CHANNELS.FILE_MOVE]: (source: string, destination: string) => Promise<void>;
  [IPC_CHANNELS.FILE_COPY]: (source: string, destination: string) => Promise<void>;
  [IPC_CHANNELS.FILE_LIST_DIR]: (path: string) => Promise<FileMetadata[]>;
  [IPC_CHANNELS.FILE_METADATA]: (path: string) => Promise<FileMetadata>;

  // File System Watch
  [IPC_CHANNELS.FILE_WATCH_START]: (path: string) => Promise<string>;
  [IPC_CHANNELS.FILE_WATCH_STOP]: (watchId: string) => Promise<void>;

  // Security
  [IPC_CHANNELS.SECURITY_VALIDATE_PATH]: (path: string) => Promise<boolean>;
  [IPC_CHANNELS.SECURITY_GET_ROOT]: () => Promise<string>;
  [IPC_CHANNELS.SECURITY_SET_ROOT]: (path: string) => Promise<void>;

  // Backup/Undo
  [IPC_CHANNELS.BACKUP_CREATE]: (path: string) => Promise<string>;
  [IPC_CHANNELS.BACKUP_RESTORE]: (backupId: string) => Promise<void>;
  [IPC_CHANNELS.OPERATION_UNDO]: (operationId: string) => Promise<void>;

  // System
  [IPC_CHANNELS.SYSTEM_GET_PATH]: (name: string) => Promise<string>;
  [IPC_CHANNELS.SYSTEM_OPEN_DIALOG]: (options: OpenDialogOptions) => Promise<string[] | undefined>;
  [IPC_CHANNELS.SYSTEM_SAVE_DIALOG]: (options: SaveDialogOptions) => Promise<string | undefined>;
}

export interface OpenDialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: FileFilter[];
  properties?: Array<'openFile' | 'openDirectory' | 'multiSelections'>;
}

export interface SaveDialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: FileFilter[];
}

export interface FileFilter {
  name: string;
  extensions: string[];
}

// Error Types
export class IPCError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: any
  ) {
    super(message);
    this.name = 'IPCError';
  }
}

export class FileOperationError extends IPCError {
  constructor(message: string, code: string, context?: any) {
    super(message, code, context);
    this.name = 'FileOperationError';
  }
}

export class SecurityError extends IPCError {
  constructor(message: string, code: string = 'SECURITY_ERROR', context?: any) {
    super(message, code, context);
    this.name = 'SecurityError';
  }
}
