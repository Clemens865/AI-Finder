/**
 * Window Manager - Advanced window management with system tray integration
 */

import { app, BrowserWindow, Menu, Tray, nativeImage, shell } from 'electron';
import { join } from 'path';

export interface WindowConfig {
  width?: number;
  height?: number;
  minWidth?: number;
  minHeight?: number;
  title?: string;
  backgroundColor?: string;
  frame?: boolean;
  transparent?: boolean;
  alwaysOnTop?: boolean;
}

export class WindowManager {
  private mainWindow: BrowserWindow | null = null;
  private tray: Tray | null = null;
  private preloadPath: string;
  private isDevelopment: boolean;

  constructor(preloadPath: string) {
    this.preloadPath = preloadPath;
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  /**
   * Create main application window
   */
  async createMainWindow(config: WindowConfig = {}): Promise<BrowserWindow> {
    const defaultConfig: WindowConfig = {
      width: 1400,
      height: 900,
      minWidth: 1200,
      minHeight: 800,
      title: 'Intelligent Finder',
      backgroundColor: '#1a1a1a',
      frame: true,
      transparent: false,
      alwaysOnTop: false,
      ...config
    };

    this.mainWindow = new BrowserWindow({
      width: defaultConfig.width,
      height: defaultConfig.height,
      minWidth: defaultConfig.minWidth,
      minHeight: defaultConfig.minHeight,
      title: defaultConfig.title,
      backgroundColor: defaultConfig.backgroundColor,
      frame: defaultConfig.frame,
      transparent: defaultConfig.transparent,
      alwaysOnTop: defaultConfig.alwaysOnTop,
      webPreferences: {
        preload: this.preloadPath,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
        devTools: this.isDevelopment
      },
      show: false // Don't show until ready
    });

    // Load the app
    if (this.isDevelopment) {
      await this.mainWindow.loadURL('http://localhost:5173');
      this.mainWindow.webContents.openDevTools();
    } else {
      await this.mainWindow.loadFile(join(__dirname, '../../renderer/index.html'));
    }

    // Show window when ready
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
      console.log('[WindowManager] Main window displayed');
    });

    // Setup window event handlers
    this.setupWindowHandlers();

    // Setup context menu
    this.setupContextMenu();

    console.log('[WindowManager] Main window created');
    return this.mainWindow;
  }

  /**
   * Setup window event handlers
   */
  private setupWindowHandlers(): void {
    if (!this.mainWindow) return;

    // Handle window close
    this.mainWindow.on('close', (event) => {
      if (process.platform === 'darwin') {
        // On macOS, hide window instead of closing
        event.preventDefault();
        this.mainWindow?.hide();
      }
    });

    // Handle window closed
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    // Handle window minimize
    this.mainWindow.on('minimize', () => {
      if (this.tray) {
        this.mainWindow?.hide();
      }
    });

    // Handle window blur (lost focus)
    this.mainWindow.on('blur', () => {
      console.log('[WindowManager] Window lost focus');
    });

    // Handle window focus
    this.mainWindow.on('focus', () => {
      console.log('[WindowManager] Window gained focus');
    });

    // Handle external links
    this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });

    // Handle navigation
    this.mainWindow.webContents.on('will-navigate', (event, url) => {
      // Only allow navigation within the app in production
      if (!this.isDevelopment && !url.startsWith('file://')) {
        event.preventDefault();
      }
    });
  }

  /**
   * Setup context menu for window
   */
  private setupContextMenu(): void {
    if (!this.mainWindow || !this.isDevelopment) return;

    this.mainWindow.webContents.on('context-menu', (_event, params) => {
      const contextMenu = Menu.buildFromTemplate([
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'cut', enabled: params.editFlags.canCut },
        { role: 'copy', enabled: params.editFlags.canCopy },
        { role: 'paste', enabled: params.editFlags.canPaste },
        { role: 'selectAll' }
      ]);

      contextMenu.popup();
    });
  }

  /**
   * Create system tray
   */
  createSystemTray(): void {
    // Create tray icon
    const iconPath = this.getTrayIconPath();
    const icon = nativeImage.createFromPath(iconPath);

    this.tray = new Tray(icon.resize({ width: 16, height: 16 }));
    this.tray.setToolTip('Intelligent Finder');

    // Create tray menu
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show Intelligent Finder',
        click: () => this.showWindow()
      },
      { type: 'separator' },
      {
        label: 'Quick Actions',
        submenu: [
          {
            label: 'Open Documents Folder',
            click: () => this.openDocumentsFolder()
          },
          {
            label: 'Recent Files',
            click: () => this.showRecentFiles()
          },
          { type: 'separator' },
          {
            label: 'Search Files',
            click: () => {
              this.showWindow();
              this.focusSearchBox();
            }
          }
        ]
      },
      { type: 'separator' },
      {
        label: 'Preferences',
        click: () => {
          this.showWindow();
          this.openPreferences();
        }
      },
      { type: 'separator' },
      {
        label: 'Quit Intelligent Finder',
        role: 'quit'
      }
    ]);

    this.tray.setContextMenu(contextMenu);

    // Handle tray click
    this.tray.on('click', () => {
      this.toggleWindow();
    });

    // Handle double click
    this.tray.on('double-click', () => {
      this.showWindow();
    });

    console.log('[WindowManager] System tray created');
  }

  /**
   * Get appropriate tray icon path
   */
  private getTrayIconPath(): string {
    const iconName = process.platform === 'win32' ? 'icon.ico' :
                     process.platform === 'darwin' ? 'iconTemplate.png' :
                     'icon.png';

    return join(__dirname, '../../resources', iconName);
  }

  /**
   * Show main window
   */
  showWindow(): void {
    if (!this.mainWindow) {
      console.warn('[WindowManager] Cannot show window - not initialized');
      return;
    }

    if (this.mainWindow.isMinimized()) {
      this.mainWindow.restore();
    }

    this.mainWindow.show();
    this.mainWindow.focus();
  }

  /**
   * Hide main window
   */
  hideWindow(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.hide();
    }
  }

  /**
   * Toggle window visibility
   */
  toggleWindow(): void {
    if (!this.mainWindow) return;

    if (this.mainWindow.isVisible()) {
      this.hideWindow();
    } else {
      this.showWindow();
    }
  }

  /**
   * Minimize window to tray
   */
  minimizeToTray(): void {
    if (this.mainWindow) {
      this.mainWindow.hide();
    }
  }

  /**
   * Focus search box (send message to renderer)
   */
  private focusSearchBox(): void {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('focus-search');
    }
  }

  /**
   * Open preferences (send message to renderer)
   */
  private openPreferences(): void {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('open-preferences');
    }
  }

  /**
   * Open documents folder
   */
  private async openDocumentsFolder(): Promise<void> {
    const documentsPath = app.getPath('documents');
    await shell.openPath(join(documentsPath, 'IntelligentFinder'));
  }

  /**
   * Show recent files (send message to renderer)
   */
  private showRecentFiles(): void {
    if (this.mainWindow) {
      this.showWindow();
      this.mainWindow.webContents.send('show-recent-files');
    }
  }

  /**
   * Get main window
   */
  getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }

  /**
   * Destroy tray
   */
  destroyTray(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
      console.log('[WindowManager] System tray destroyed');
    }
  }

  /**
   * Cleanup on shutdown
   */
  cleanup(): void {
    this.destroyTray();

    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.destroy();
      this.mainWindow = null;
    }

    console.log('[WindowManager] Cleanup complete');
  }

  /**
   * Set window title
   */
  setTitle(title: string): void {
    if (this.mainWindow) {
      this.mainWindow.setTitle(title);
    }
  }

  /**
   * Set window badge (macOS only)
   */
  setBadge(badge: string): void {
    if (process.platform === 'darwin') {
      app.setBadgeCount(badge ? parseInt(badge) : 0);
    }
  }

  /**
   * Flash window to get user attention
   */
  flashWindow(): void {
    if (this.mainWindow) {
      this.mainWindow.flashFrame(true);

      // Stop flashing when window is focused
      this.mainWindow.once('focus', () => {
        this.mainWindow?.flashFrame(false);
      });
    }
  }

  /**
   * Set window always on top
   */
  setAlwaysOnTop(flag: boolean): void {
    if (this.mainWindow) {
      this.mainWindow.setAlwaysOnTop(flag);
    }
  }

  /**
   * Get window bounds
   */
  getBounds(): { x: number; y: number; width: number; height: number } | null {
    return this.mainWindow?.getBounds() || null;
  }

  /**
   * Set window bounds
   */
  setBounds(bounds: { x?: number; y?: number; width?: number; height?: number }): void {
    if (this.mainWindow) {
      this.mainWindow.setBounds(bounds);
    }
  }

  /**
   * Center window on screen
   */
  centerWindow(): void {
    if (this.mainWindow) {
      this.mainWindow.center();
    }
  }
}
