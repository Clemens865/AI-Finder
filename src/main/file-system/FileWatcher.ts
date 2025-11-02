/**
 * File System Watcher - Real-time file change notifications
 */

import chokidar, { FSWatcher } from 'chokidar';
import { WatchEvent, WatchCallback } from '@shared/types/ipc';
import { SecuritySandbox } from '../security/SecuritySandbox';
import { nanoid } from 'nanoid';

export interface WatchOptions {
  persistent?: boolean;
  ignoreInitial?: boolean;
  followSymlinks?: boolean;
  depth?: number;
  ignored?: string | RegExp | Array<string | RegExp>;
}

export class FileWatcher {
  private watchers: Map<string, FSWatcher> = new Map();
  private callbacks: Map<string, WatchCallback> = new Map();
  private security: SecuritySandbox;

  constructor(security: SecuritySandbox) {
    this.security = security;
  }

  /**
   * Start watching a path
   */
  watch(path: string, callback: WatchCallback, options?: WatchOptions): string {
    // Validate path is in sandbox
    if (!this.security.validatePath(path)) {
      throw new Error('Cannot watch path outside sandbox');
    }

    const resolvedPath = this.security.resolvePath(path);
    const watchId = nanoid();

    const defaultOptions: WatchOptions = {
      persistent: true,
      ignoreInitial: true,
      followSymlinks: false,
      depth: 10,
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      ...options
    };

    const watcher = chokidar.watch(resolvedPath, defaultOptions);

    // Register event handlers
    watcher
      .on('add', (filePath) => this.handleEvent('add', filePath, callback))
      .on('change', (filePath) => this.handleEvent('change', filePath, callback))
      .on('unlink', (filePath) => this.handleEvent('unlink', filePath, callback))
      .on('addDir', (dirPath) => this.handleEvent('addDir', dirPath, callback))
      .on('unlinkDir', (dirPath) => this.handleEvent('unlinkDir', dirPath, callback))
      .on('error', (error) => {
        console.error(`[FileWatcher] Error watching ${resolvedPath}:`, error);
      })
      .on('ready', () => {
        console.log(`[FileWatcher] Watching: ${resolvedPath} (ID: ${watchId})`);
      });

    this.watchers.set(watchId, watcher);
    this.callbacks.set(watchId, callback);

    return watchId;
  }

  /**
   * Stop watching a path
   */
  async unwatch(watchId: string): Promise<void> {
    const watcher = this.watchers.get(watchId);
    if (!watcher) {
      console.warn(`[FileWatcher] No watcher found with ID: ${watchId}`);
      return;
    }

    await watcher.close();
    this.watchers.delete(watchId);
    this.callbacks.delete(watchId);

    console.log(`[FileWatcher] Stopped watching (ID: ${watchId})`);
  }

  /**
   * Stop all watchers
   */
  async unwatchAll(): Promise<void> {
    const promises = Array.from(this.watchers.keys()).map(id => this.unwatch(id));
    await Promise.all(promises);
    console.log('[FileWatcher] All watchers stopped');
  }

  /**
   * Get list of active watchers
   */
  getActiveWatchers(): string[] {
    return Array.from(this.watchers.keys());
  }

  /**
   * Handle file system events
   */
  private handleEvent(
    type: WatchEvent['type'],
    path: string,
    callback: WatchCallback
  ): void {
    // Validate path is still in sandbox
    if (!this.security.validatePath(path)) {
      console.warn(`[FileWatcher] Ignoring event for path outside sandbox: ${path}`);
      return;
    }

    const event: WatchEvent = {
      type,
      path: this.security.resolvePath(path)
    };

    try {
      callback(event);
    } catch (error) {
      console.error('[FileWatcher] Error in callback:', error);
    }
  }

  /**
   * Cleanup on shutdown
   */
  async cleanup(): Promise<void> {
    await this.unwatchAll();
  }
}
