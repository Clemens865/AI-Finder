import React from 'react';
import { FileNode as FileNodeComponent } from './FileNode';
import { Button } from '../Common/Button';
import { useFileSystem } from '../../hooks/useFileSystem';
import { useFileStore } from '../../store/fileStore';

export const FileTreeView: React.FC = () => {
  const { selectRootFolder, fileTree } = useFileSystem();
  const { isLoading, error, rootPath } = useFileStore();

  return (
    <div className="h-full flex flex-col">
      {/* Header Actions */}
      <div className="p-4 space-y-2">
        <Button
          onClick={selectRootFolder}
          variant="secondary"
          size="sm"
          fullWidth
          disabled={isLoading}
        >
          {isLoading ? 'Loading...' : 'Select Folder'}
        </Button>

        {error && (
          <div className="text-xs text-red-400 p-2 bg-red-900/20 rounded border border-red-800">
            {error}
          </div>
        )}
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-auto px-2">
        {!rootPath ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            <div className="text-center">
              <svg
                className="mx-auto h-10 w-10 text-gray-600 mb-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                />
              </svg>
              <p>Select a folder to get started</p>
            </div>
          </div>
        ) : fileTree.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            <p>No files in this directory</p>
          </div>
        ) : (
          <div className="space-y-1 py-2">
            {fileTree.map((node) => (
              <FileNodeComponent key={node.id} node={node} level={0} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
