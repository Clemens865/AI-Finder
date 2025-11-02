/**
 * Electron Main Process Entry Point
 */

import { app } from 'electron';
import { join } from 'path';
import { SecuritySandbox } from './security/SecuritySandbox';
import { FileSystemManager } from './file-system/FileSystemManager';
import { FileWatcher } from './file-system/FileWatcher';
import { IPCBridge } from './ipc/IPCBridge';
import { WindowManager } from './window/WindowManager';
import { BackupManager } from './backup/BackupManager';

class MainProcess {
  private windowManager: WindowManager | null = null;
  private security: SecuritySandbox | null = null;
  private fileSystem: FileSystemManager | null = null;
  private fileWatcher: FileWatcher | null = null;
  private backupManager: BackupManager | null = null;
  private ipcBridge: IPCBridge | null = null;

  async initialize(): Promise<void> {
    console.log('[Main] Initializing Intelligent Finder...');

    // Wait for app to be ready
    await app.whenReady();

    // Setup security sandbox
    await this.setupSecurity();

    // Initialize window manager
    this.windowManager = new WindowManager(join(__dirname, 'preload.js'));

    // Create main window
    await this.windowManager.createMainWindow();

    // Create system tray
    this.windowManager.createSystemTray();

    // Setup IPC communication
    await this.setupIPC();

    // Setup app event handlers
    this.setupAppHandlers();

    console.log('[Main] Initialization complete');
  }

  private async setupSecurity(): Promise<void> {
    console.log('[Main] Setting up security sandbox...');

    // Get default documents directory
    const documentsPath = app.getPath('documents');
    const rootDirectory = join(documentsPath, 'IntelligentFinder');

    this.security = new SecuritySandbox({
      rootDirectory,
      allowedOperations: ['read', 'write', 'delete', 'rename', 'move', 'copy'],
      backupEnabled: true,
      maxFileSize: 100 * 1024 * 1024, // 100MB
      blockedExtensions: ['.exe', '.dll', '.bat', '.cmd', '.sh'],
      auditLog: true
    });

    // Initialize backup manager
    this.backupManager = new BackupManager(this.security, undefined, {
      maxBackups: 100,
      retentionDays: 30,
      compress: false
    });

    console.log(`[Main] Security sandbox configured with root: ${rootDirectory}`);
  }

  // Window creation is now handled by WindowManager

  private async setupIPC(): Promise<void> {
    const window = this.windowManager?.getMainWindow();
    if (!window || !this.security || !this.backupManager) {
      throw new Error('Window, security, or backup manager not initialized');
    }

    console.log('[Main] Setting up IPC communication...');

    // Initialize file system components
    this.fileSystem = new FileSystemManager(this.security);
    this.fileWatcher = new FileWatcher(this.security);

    // Setup IPC bridge
    this.ipcBridge = new IPCBridge(
      this.fileSystem,
      this.fileWatcher,
      this.security,
      this.backupManager,
      window
    );

    console.log('[Main] IPC communication ready');
  }

  private setupAppHandlers(): void {
    // Quit when all windows are closed (except on macOS)
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    // Recreate window on macOS when dock icon is clicked
    app.on('activate', () => {
      if (!this.windowManager?.getMainWindow()) {
        this.windowManager?.createMainWindow();
      }
    });

    // Cleanup before quit
    app.on('before-quit', async () => {
      console.log('[Main] Cleaning up before quit...');

      if (this.fileWatcher) {
        await this.fileWatcher.cleanup();
      }

      if (this.backupManager) {
        await this.backupManager.cleanup();
      }

      if (this.ipcBridge) {
        this.ipcBridge.cleanup();
      }

      if (this.windowManager) {
        this.windowManager.cleanup();
      }

      if (this.security) {
        const stats = this.security.getStatistics();
        console.log('[Main] Security statistics:', stats);
      }

      if (this.backupManager) {
        const backupStats = this.backupManager.getStatistics();
        console.log('[Main] Backup statistics:', backupStats);
      }

      console.log('[Main] Cleanup complete');
    });

    // Handle app errors
    process.on('uncaughtException', (error) => {
      console.error('[Main] Uncaught exception:', error);
    });

    process.on('unhandledRejection', (reason) => {
      console.error('[Main] Unhandled rejection:', reason);
    });
  }
}

// Create and initialize main process
const mainProcess = new MainProcess();

mainProcess.initialize().catch((error) => {
  console.error('[Main] Failed to initialize:', error);
  app.quit();
});

// Export for potential use in other modules
export default mainProcess;
