import React, { useState } from 'react';
import { FileTreeView } from './components/FileTree/FileTreeView';
import { ChatInterface } from './components/Chat/ChatInterface';
import { Button } from './components/Common/Button';
import { useFileStore } from './store/fileStore';

const App: React.FC = () => {
  const [showChat, setShowChat] = useState(false);
  const { rootPath, selectedFile } = useFileStore();

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100">
      {/* Sidebar - File Tree */}
      <div className="w-80 border-r border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h1 className="text-xl font-bold text-blue-400">Intelligent Finder</h1>
          <p className="text-sm text-gray-400 mt-1">
            {rootPath || 'No folder selected'}
          </p>
        </div>

        <div className="flex-1 overflow-hidden">
          <FileTreeView />
        </div>

        <div className="p-4 border-t border-gray-700">
          <Button
            onClick={() => setShowChat(!showChat)}
            variant="primary"
            fullWidth
          >
            {showChat ? 'Hide Chat' : 'Show Chat'}
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="h-14 border-b border-gray-700 flex items-center px-6">
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-400">
              {selectedFile ? `Selected: ${selectedFile.name}` : 'No file selected'}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex">
          {/* File Preview/Content Area */}
          <div className="flex-1 p-6 overflow-auto">
            {selectedFile ? (
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h2 className="text-lg font-semibold mb-4">{selectedFile.name}</h2>
                <div className="space-y-2 text-sm text-gray-300">
                  <p><span className="text-gray-500">Type:</span> {selectedFile.type}</p>
                  <p><span className="text-gray-500">Size:</span> {(selectedFile.size / 1024).toFixed(2)} KB</p>
                  <p><span className="text-gray-500">Path:</span> {selectedFile.path}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <p className="mt-4">Select a file to view details</p>
                </div>
              </div>
            )}
          </div>

          {/* Chat Interface (conditionally shown) */}
          {showChat && (
            <div className="w-96 border-l border-gray-700">
              <ChatInterface />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
