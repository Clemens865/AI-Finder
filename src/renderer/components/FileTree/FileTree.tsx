import { useCallback, useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import { useFileStore } from '@store/fileStore';
import { FileTreeNode } from './FileTreeNode';
import { FileNode } from '@types/index';
import { Input } from '@components/UI';
import { Search, FolderOpen } from 'lucide-react';

export const FileTree = () => {
  const { files, expandedNodes, searchQuery, setSearchQuery, isScanning } = useFileStore();

  // Flatten tree for virtual scrolling
  const flattenedNodes = useMemo(() => {
    const flattened: Array<{ node: FileNode; depth: number }> = [];

    const flatten = (nodes: FileNode[], depth = 0) => {
      nodes.forEach((node) => {
        flattened.push({ node, depth });
        if (node.children && expandedNodes.has(node.id)) {
          flatten(node.children, depth + 1);
        }
      });
    };

    flatten(files);
    return flattened;
  }, [files, expandedNodes]);

  // Filter nodes based on search
  const filteredNodes = useMemo(() => {
    if (!searchQuery) return flattenedNodes;

    return flattenedNodes.filter(({ node }) =>
      node.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [flattenedNodes, searchQuery]);

  const Row = useCallback(
    ({ index, style }: { index: number; style: React.CSSProperties }) => {
      const { node, depth } = filteredNodes[index];
      return (
        <div style={style}>
          <FileTreeNode node={node} depth={depth} />
        </div>
      );
    },
    [filteredNodes]
  );

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <FolderOpen className="w-5 h-5" />
            Files
          </h2>
          {isScanning && (
            <span className="text-xs text-primary-600 dark:text-primary-400 animate-pulse">
              Scanning...
            </span>
          )}
        </div>

        {/* Search Input */}
        <Input
          placeholder="Search files..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          leftIcon={<Search className="w-4 h-4" />}
        />
      </div>

      {/* File Tree List */}
      <div className="flex-1 overflow-hidden">
        {filteredNodes.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
            {searchQuery ? 'No files found' : 'No files loaded'}
          </div>
        ) : (
          <List
            height={600}
            itemCount={filteredNodes.length}
            itemSize={36}
            width="100%"
            className="scrollbar-thin"
          >
            {Row}
          </List>
        )}
      </div>

      {/* Footer Stats */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400">
        {filteredNodes.length} items
        {searchQuery && ` (filtered from ${flattenedNodes.length})`}
      </div>
    </div>
  );
};
