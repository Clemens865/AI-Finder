/**
 * Preload Script - Exposes safe IPC methods to renderer process
 * This script runs in a sandboxed context with access to both Node.js and DOM APIs
 */

import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, WatchCallback } from '@shared/types/ipc';

// Expose protected methods that allow renderer to use IPC safely
contextBridge.exposeInMainWorld('electron', {
  // File Operations
  fileRead: (path: string, options?: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.FILE_READ, path, options),

  fileWrite: (path: string, content: string | Buffer, options?: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.FILE_WRITE, path, content, options),

  fileDelete: (path: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.FILE_DELETE, path),

  fileRename: (oldPath: string, newPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.FILE_RENAME, oldPath, newPath),

  fileMove: (source: string, destination: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.FILE_MOVE, source, destination),

  fileCopy: (source: string, destination: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.FILE_COPY, source, destination),

  fileListDir: (path: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.FILE_LIST_DIR, path),

  fileMetadata: (path: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.FILE_METADATA, path),

  // File System Watch
  fileWatchStart: (path: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.FILE_WATCH_START, path),

  fileWatchStop: (watchId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.FILE_WATCH_STOP, watchId),

  fileWatchOn: (callback: WatchCallback) => {
    ipcRenderer.on(IPC_CHANNELS.FILE_WATCH_EVENT, (_event, data) => callback(data));
  },

  fileWatchOff: (callback: WatchCallback) => {
    ipcRenderer.removeListener(IPC_CHANNELS.FILE_WATCH_EVENT, callback as any);
  },

  // Security
  securityValidatePath: (path: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SECURITY_VALIDATE_PATH, path),

  securityGetRoot: () =>
    ipcRenderer.invoke(IPC_CHANNELS.SECURITY_GET_ROOT),

  securitySetRoot: (path: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SECURITY_SET_ROOT, path),

  // System
  systemGetPath: (name: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_GET_PATH, name),

  systemOpenDialog: (options: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_OPEN_DIALOG, options),

  systemSaveDialog: (options: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_SAVE_DIALOG, options),
});

// Type declaration for TypeScript
declare global {
  interface Window {
    electron: {
      fileRead: (path: string, options?: any) => Promise<any>;
      fileWrite: (path: string, content: string | Buffer, options?: any) => Promise<void>;
      fileDelete: (path: string) => Promise<void>;
      fileRename: (oldPath: string, newPath: string) => Promise<void>;
      fileMove: (source: string, destination: string) => Promise<void>;
      fileCopy: (source: string, destination: string) => Promise<void>;
      fileListDir: (path: string) => Promise<any[]>;
      fileMetadata: (path: string) => Promise<any>;
      fileWatchStart: (path: string) => Promise<string>;
      fileWatchStop: (watchId: string) => Promise<void>;
      fileWatchOn: (callback: WatchCallback) => void;
      fileWatchOff: (callback: WatchCallback) => void;
      securityValidatePath: (path: string) => Promise<boolean>;
      securityGetRoot: () => Promise<string>;
      securitySetRoot: (path: string) => Promise<void>;
      systemGetPath: (name: string) => Promise<string>;
      systemOpenDialog: (options: any) => Promise<string[] | undefined>;
      systemSaveDialog: (options: any) => Promise<string | undefined>;
    };
  }
}
