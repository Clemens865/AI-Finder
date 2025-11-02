import { useCallback, useEffect } from 'react';
import { useFileStore, FileNode } from '../store/fileStore';

/**
 * Hook for file system operations via IPC
 * Coordinates with Electron main process for file operations
 */
export const useFileSystem = () => {
  const {
    rootPath,
    setRootPath,
    fileTree,
    setFileTree,
    updateNode,
    setIsLoading,
    setError,
    selectFile,
    setMetadata,
  } = useFileStore();

  /**
   * Select a root folder to work with
   */
  const selectRootFolder = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // IPC call to main process to open folder dialog
      const result = await window.electron?.invoke('file:selectFolder');

      if (result?.path) {
        setRootPath(result.path);
        // Load initial file tree
        await loadFileTree(result.path);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to select folder');
    } finally {
      setIsLoading(false);
    }
  }, [setRootPath, setIsLoading, setError]);

  /**
   * Load file tree for a given path
   */
  const loadFileTree = useCallback(async (path: string) => {
    try {
      setIsLoading(true);
      setError(null);

      // IPC call to get directory contents
      const tree = await window.electron?.invoke('file:readDirectory', path);

      if (tree) {
        setFileTree(tree);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load file tree');
    } finally {
      setIsLoading(false);
    }
  }, [setFileTree, setIsLoading, setError]);

  /**
   * Read file content
   */
  const readFile = useCallback(async (path: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const content = await window.electron?.invoke('file:read', path);
      return content;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to read file');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [setIsLoading, setError]);

  /**
   * Write file content
   */
  const writeFile = useCallback(async (path: string, content: any, options?: any) => {
    try {
      setIsLoading(true);
      setError(null);

      await window.electron?.invoke('file:write', path, content, options);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to write file');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [setIsLoading, setError]);

  /**
   * Get file metadata
   */
  const getFileMetadata = useCallback(async (path: string) => {
    try {
      const metadata = await window.electron?.invoke('file:getMetadata', path);

      if (metadata) {
        setMetadata(path, metadata);
      }

      return metadata;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to get metadata');
      throw error;
    }
  }, [setMetadata, setError]);

  /**
   * Extract structured data from file
   */
  const extractData = useCallback(async (path: string, schema?: any) => {
    try {
      setIsLoading(true);
      setError(null);

      const data = await window.electron?.invoke('file:extract', path, schema);
      return data;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to extract data');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [setIsLoading, setError]);

  /**
   * Expand/collapse directory
   */
  const toggleDirectory = useCallback(async (node: FileNode) => {
    if (node.type !== 'directory') return;

    // If already expanded, just collapse
    if (node.isExpanded) {
      updateNode(node.id, { isExpanded: false });
      return;
    }

    // Load children if not loaded
    if (!node.children || node.children.length === 0) {
      try {
        updateNode(node.id, { isLoading: true });
        const children = await window.electron?.invoke('file:readDirectory', node.path);
        updateNode(node.id, {
          children,
          isExpanded: true,
          isLoading: false,
        });
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to load directory');
        updateNode(node.id, { isLoading: false });
      }
    } else {
      updateNode(node.id, { isExpanded: true });
    }
  }, [updateNode, setError]);

  /**
   * Handle file selection
   */
  const handleFileSelect = useCallback(async (node: FileNode) => {
    selectFile(node);

    // Load metadata in background
    if (node.type === 'file') {
      getFileMetadata(node.path);
    }
  }, [selectFile, getFileMetadata]);

  // Load initial file tree when root path changes
  useEffect(() => {
    if (rootPath) {
      loadFileTree(rootPath);
    }
  }, [rootPath]);

  return {
    // State
    rootPath,
    fileTree,

    // Actions
    selectRootFolder,
    loadFileTree,
    readFile,
    writeFile,
    getFileMetadata,
    extractData,
    toggleDirectory,
    handleFileSelect,
  };
};

// Type definitions for window.electron
declare global {
  interface Window {
    electron?: {
      invoke: (channel: string, ...args: any[]) => Promise<any>;
      on: (channel: string, callback: (...args: any[]) => void) => void;
      removeListener: (channel: string, callback: (...args: any[]) => void) => void;
    };
  }
}
