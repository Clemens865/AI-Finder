import { memo } from 'react';
import { FileNode } from '@types/index';
import { useFileStore } from '@store/fileStore';
import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from 'lucide-react';
import { Badge } from '@components/UI';
import clsx from 'clsx';

interface FileTreeNodeProps {
  node: FileNode;
  depth: number;
}

export const FileTreeNode = memo(({ node, depth }: FileTreeNodeProps) => {
  const { expandedNodes, selectedFile, toggleNode, selectFile } = useFileStore();

  const isExpanded = expandedNodes.has(node.id);
  const isSelected = selectedFile?.id === node.id;
  const hasChildren = node.children && node.children.length > 0;

  const handleClick = () => {
    selectFile(node);
    if (hasChildren) {
      toggleNode(node.id);
    }
  };

  const getIcon = () => {
    if (node.type === 'directory') {
      return isExpanded ? (
        <FolderOpen className="w-4 h-4 text-primary-500" />
      ) : (
        <Folder className="w-4 h-4 text-gray-500" />
      );
    }
    return <File className="w-4 h-4 text-gray-400" />;
  };

  return (
    <div
      className={clsx(
        'flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors',
        {
          'bg-primary-50 dark:bg-primary-900/20': isSelected,
        }
      )}
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
      onClick={handleClick}
    >
      {/* Expand/Collapse Icon */}
      {hasChildren && (
        <button
          className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            toggleNode(node.id);
          }}
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
      )}
      {!hasChildren && <div className="w-5" />}

      {/* File/Folder Icon */}
      {getIcon()}

      {/* File Name */}
      <span
        className={clsx(
          'flex-1 text-sm truncate',
          {
            'font-medium text-gray-900 dark:text-white': isSelected,
            'text-gray-700 dark:text-gray-300': !isSelected,
          }
        )}
      >
        {node.name}
      </span>

      {/* Match Score Badge */}
      {node.matchScore !== undefined && node.matchScore > 0 && (
        <Badge variant="primary" size="sm">
          {node.matchScore.toFixed(1)}
        </Badge>
      )}

      {/* Match Count */}
      {node.matches && node.matches.length > 0 && (
        <Badge variant="success" size="sm">
          {node.matches.length}
        </Badge>
      )}
    </div>
  );
});

FileTreeNode.displayName = 'FileTreeNode';
