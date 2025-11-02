import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface FileNode {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  children?: FileNode[];
  isExpanded?: boolean;
  isLoading?: boolean;
}

export interface FileMetadata {
  checksum: string;
  createdAt: Date;
  modifiedAt: Date;
  indexedAt: Date;
  extractedData?: any;
}

interface FileState {
  // Root path
  rootPath: string | null;
  setRootPath: (path: string) => void;

  // File tree
  fileTree: FileNode[];
  setFileTree: (tree: FileNode[]) => void;
  updateNode: (id: string, updates: Partial<FileNode>) => void;

  // Selection
  selectedFile: FileNode | null;
  selectFile: (file: FileNode | null) => void;

  // Expanded nodes
  expandedNodes: Set<string>;
  toggleNode: (nodeId: string) => void;

  // Loading state
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;

  // Error handling
  error: string | null;
  setError: (error: string | null) => void;

  // File metadata cache
  metadataCache: Map<string, FileMetadata>;
  setMetadata: (path: string, metadata: FileMetadata) => void;
  getMetadata: (path: string) => FileMetadata | undefined;
}

export const useFileStore = create<FileState>()(
  persist(
    (set, get) => ({
      // Root path
      rootPath: null,
      setRootPath: (path: string) => set({ rootPath: path }),

      // File tree
      fileTree: [],
      setFileTree: (tree: FileNode[]) => set({ fileTree: tree }),

      updateNode: (id: string, updates: Partial<FileNode>) => {
        const updateNodeRecursive = (nodes: FileNode[]): FileNode[] => {
          return nodes.map(node => {
            if (node.id === id) {
              return { ...node, ...updates };
            }
            if (node.children) {
              return {
                ...node,
                children: updateNodeRecursive(node.children)
              };
            }
            return node;
          });
        };

        set(state => ({
          fileTree: updateNodeRecursive(state.fileTree)
        }));
      },

      // Selection
      selectedFile: null,
      selectFile: (file: FileNode | null) => set({ selectedFile: file }),

      // Expanded nodes
      expandedNodes: new Set<string>(),
      toggleNode: (nodeId: string) => {
        set(state => {
          const newExpanded = new Set(state.expandedNodes);
          if (newExpanded.has(nodeId)) {
            newExpanded.delete(nodeId);
          } else {
            newExpanded.add(nodeId);
          }
          return { expandedNodes: newExpanded };
        });
      },

      // Loading state
      isLoading: false,
      setIsLoading: (loading: boolean) => set({ isLoading: loading }),

      // Error handling
      error: null,
      setError: (error: string | null) => set({ error: error }),

      // Metadata cache
      metadataCache: new Map(),
      setMetadata: (path: string, metadata: FileMetadata) => {
        set(state => {
          const newCache = new Map(state.metadataCache);
          newCache.set(path, metadata);
          return { metadataCache: newCache };
        });
      },
      getMetadata: (path: string) => {
        return get().metadataCache.get(path);
      },
    }),
    {
      name: 'file-store',
      partialize: (state) => ({
        rootPath: state.rootPath,
        expandedNodes: Array.from(state.expandedNodes),
      }),
    }
  )
);
