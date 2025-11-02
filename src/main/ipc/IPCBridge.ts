/**
 * IPC Bridge - Communication between main and renderer processes
 */

import { ipcMain, IpcMainInvokeEvent, dialog, app } from 'electron';
import { IPC_CHANNELS, IPCError } from '@shared/types/ipc';
import { FileSystemManager } from '../file-system/FileSystemManager';
import { FileWatcher } from '../file-system/FileWatcher';
import { SecuritySandbox } from '../security/SecuritySandbox';
import { BackupManager } from '../backup/BackupManager';
import { BrowserWindow } from 'electron';

export class IPCBridge {
  private fileSystem: FileSystemManager;
  private fileWatcher: FileWatcher;
  private security: SecuritySandbox;
  private backupManager: BackupManager;
  private window: BrowserWindow;
  private operationHistory: Map<string, any> = new Map();

  constructor(
    fileSystem: FileSystemManager,
    fileWatcher: FileWatcher,
    security: SecuritySandbox,
    backupManager: BackupManager,
    window: BrowserWindow
  ) {
    this.fileSystem = fileSystem;
    this.fileWatcher = fileWatcher;
    this.security = security;
    this.backupManager = backupManager;
    this.window = window;

    this.setupHandlers();
  }

  /**
   * Setup all IPC handlers
   */
  private setupHandlers(): void {
    // File Operations
    this.handle(IPC_CHANNELS.FILE_READ, this.handleFileRead.bind(this));
    this.handle(IPC_CHANNELS.FILE_WRITE, this.handleFileWrite.bind(this));
    this.handle(IPC_CHANNELS.FILE_DELETE, this.handleFileDelete.bind(this));
    this.handle(IPC_CHANNELS.FILE_RENAME, this.handleFileRename.bind(this));
    this.handle(IPC_CHANNELS.FILE_MOVE, this.handleFileMove.bind(this));
    this.handle(IPC_CHANNELS.FILE_COPY, this.handleFileCopy.bind(this));
    this.handle(IPC_CHANNELS.FILE_LIST_DIR, this.handleFileListDir.bind(this));
    this.handle(IPC_CHANNELS.FILE_METADATA, this.handleFileMetadata.bind(this));

    // File System Watch
    this.handle(IPC_CHANNELS.FILE_WATCH_START, this.handleWatchStart.bind(this));
    this.handle(IPC_CHANNELS.FILE_WATCH_STOP, this.handleWatchStop.bind(this));

    // Security
    this.handle(IPC_CHANNELS.SECURITY_VALIDATE_PATH, this.handleSecurityValidatePath.bind(this));
    this.handle(IPC_CHANNELS.SECURITY_GET_ROOT, this.handleSecurityGetRoot.bind(this));
    this.handle(IPC_CHANNELS.SECURITY_SET_ROOT, this.handleSecuritySetRoot.bind(this));

    // Backup/Undo
    this.handle(IPC_CHANNELS.BACKUP_CREATE, this.handleBackupCreate.bind(this));
    this.handle(IPC_CHANNELS.BACKUP_RESTORE, this.handleBackupRestore.bind(this));
    this.handle(IPC_CHANNELS.OPERATION_UNDO, this.handleOperationUndo.bind(this));

    // System
    this.handle(IPC_CHANNELS.SYSTEM_GET_PATH, this.handleSystemGetPath.bind(this));
    this.handle(IPC_CHANNELS.SYSTEM_OPEN_DIALOG, this.handleSystemOpenDialog.bind(this));
    this.handle(IPC_CHANNELS.SYSTEM_SAVE_DIALOG, this.handleSystemSaveDialog.bind(this));

    console.log('[IPC] All handlers registered');
  }

  /**
   * Helper to register IPC handlers with error handling
   */
  private handle(channel: string, handler: (event: IpcMainInvokeEvent, ...args: any[]) => Promise<any>): void {
    ipcMain.handle(channel, async (event, ...args) => {
      try {
        return await handler(event, ...args);
      } catch (error) {
        console.error(`[IPC] Error in ${channel}:`, error);

        if (error instanceof IPCError) {
          throw error;
        }

        throw new IPCError(
          error instanceof Error ? error.message : 'Unknown error',
          'IPC_ERROR',
          { channel, args }
        );
      }
    });
  }

  // File Operation Handlers

  private async handleFileRead(event: IpcMainInvokeEvent, path: string, options?: any) {
    return this.fileSystem.read(path, options);
  }

  private async handleFileWrite(event: IpcMainInvokeEvent, path: string, content: string | Buffer, options?: any) {
    return this.fileSystem.write(path, content, options);
  }

  private async handleFileDelete(event: IpcMainInvokeEvent, path: string) {
    return this.fileSystem.delete(path);
  }

  private async handleFileRename(event: IpcMainInvokeEvent, oldPath: string, newPath: string) {
    return this.fileSystem.rename(oldPath, newPath);
  }

  private async handleFileMove(event: IpcMainInvokeEvent, source: string, destination: string) {
    return this.fileSystem.move(source, destination);
  }

  private async handleFileCopy(event: IpcMainInvokeEvent, source: string, destination: string) {
    return this.fileSystem.copy(source, destination);
  }

  private async handleFileListDir(event: IpcMainInvokeEvent, path: string) {
    return this.fileSystem.listDirectory(path);
  }

  private async handleFileMetadata(event: IpcMainInvokeEvent, path: string) {
    return this.fileSystem.getMetadata(path);
  }

  // File Watch Handlers

  private async handleWatchStart(event: IpcMainInvokeEvent, path: string) {
    const watchId = this.fileWatcher.watch(path, (watchEvent) => {
      // Send event to renderer
      this.window.webContents.send(IPC_CHANNELS.FILE_WATCH_EVENT, watchEvent);
    });
    return watchId;
  }

  private async handleWatchStop(event: IpcMainInvokeEvent, watchId: string) {
    return this.fileWatcher.unwatch(watchId);
  }

  // Security Handlers

  private async handleSecurityValidatePath(event: IpcMainInvokeEvent, path: string) {
    return this.security.validatePath(path);
  }

  private async handleSecurityGetRoot() {
    return this.security.getRootPath();
  }

  private async handleSecuritySetRoot(event: IpcMainInvokeEvent, path: string) {
    return this.security.setRootPath(path);
  }

  // Backup/Undo Handlers

  private async handleBackupCreate(event: IpcMainInvokeEvent, path: string) {
    const backupInfo = await this.backupManager.createBackup(path, 'manual');
    return backupInfo.id;
  }

  private async handleBackupRestore(event: IpcMainInvokeEvent, backupId: string) {
    await this.backupManager.restoreBackup(backupId);
  }

  private async handleOperationUndo(event: IpcMainInvokeEvent, operationId: string) {
    // Get the operation from history
    const operation = this.operationHistory.get(operationId);

    if (!operation) {
      throw new IPCError('Operation not found', 'OPERATION_NOT_FOUND', { operationId });
    }

    // Get the most recent backup for the affected file
    const backups = this.backupManager.getBackupsForFile(operation.path);

    if (backups.length === 0) {
      throw new IPCError('No backup available for undo', 'NO_BACKUP_AVAILABLE', { operationId });
    }

    // Restore the most recent backup
    await this.backupManager.restoreBackup(backups[0].id);

    // Remove operation from history
    this.operationHistory.delete(operationId);
  }

  // System Handlers

  private async handleSystemGetPath(event: IpcMainInvokeEvent, name: string) {
    return app.getPath(name as any);
  }

  private async handleSystemOpenDialog(event: IpcMainInvokeEvent, options: any) {
    const result = await dialog.showOpenDialog(this.window, options);
    return result.canceled ? undefined : result.filePaths;
  }

  private async handleSystemSaveDialog(event: IpcMainInvokeEvent, options: any) {
    const result = await dialog.showSaveDialog(this.window, options);
    return result.canceled ? undefined : result.filePath;
  }

  /**
   * Cleanup on shutdown
   */
  cleanup(): void {
    // Remove all handlers
    Object.values(IPC_CHANNELS).forEach(channel => {
      ipcMain.removeHandler(channel);
    });

    console.log('[IPC] All handlers removed');
  }
}
