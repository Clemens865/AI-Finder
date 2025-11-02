import { useCallback } from 'react';
import { useFileStore } from '@store/fileStore';
import { useLoadingStore } from '@store/loadingStore';
import { useNotificationStore } from '@store/notificationStore';
import { FileNode } from '@types/index';

export const useFileOperations = () => {
  const { setFiles, setIsScanning } = useFileStore();
  const { setLoading } = useLoadingStore();
  const { addNotification } = useNotificationStore();

  const scanDirectory = useCallback(async (path: string) => {
    try {
      setIsScanning(true);
      setLoading(true, 'Scanning directory...');

      // In production, this would call the Electron IPC
      // For now, simulate with mock data
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const mockFiles: FileNode[] = [
        {
          id: '1',
          name: 'src',
          path: '/src',
          type: 'directory',
          children: [
            {
              id: '2',
              name: 'index.ts',
              path: '/src/index.ts',
              type: 'file',
              size: 1024,
              modified: new Date(),
            },
          ],
        },
      ];

      setFiles(mockFiles);

      addNotification({
        type: 'success',
        title: 'Scan Complete',
        message: `Found ${mockFiles.length} items`,
      });
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Scan Failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsScanning(false);
      setLoading(false);
    }
  }, [setFiles, setIsScanning, setLoading, addNotification]);

  const openFile = useCallback(async (filePath: string) => {
    try {
      // In production, call Electron IPC to open file
      console.log('Opening file:', filePath);

      addNotification({
        type: 'info',
        title: 'File Opened',
        message: filePath,
      });
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Failed to Open File',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }, [addNotification]);

  return {
    scanDirectory,
    openFile,
  };
};
