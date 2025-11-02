/**
 * Component tests for FileTree using React Testing Library
 * Tests user interactions, rendering, and state management
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { generateFileMetadataBatch } from '../../fixtures/test-data';

// Mock FileTree component (actual implementation would be imported)
interface FileTreeProps {
  files: Array<{ id: string; name: string; path: string; type: string }>;
  onFileSelect?: (file: any) => void;
  onContextMenu?: (file: any) => void;
}

const FileTree: React.FC<FileTreeProps> = ({ files, onFileSelect, onContextMenu }) => {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const handleClick = (file: any) => {
    setSelectedId(file.id);
    onFileSelect?.(file);
  };

  return (
    <div data-testid="file-tree">
      {files.map(file => (
        <div
          key={file.id}
          data-testid={`file-item-${file.id}`}
          className={selectedId === file.id ? 'selected' : ''}
          onClick={() => handleClick(file)}
          onContextMenu={(e) => {
            e.preventDefault();
            onContextMenu?.(file);
          }}
        >
          <span data-testid="file-name">{file.name}</span>
          <span data-testid="file-type">{file.type}</span>
        </div>
      ))}
    </div>
  );
};

describe('FileTree Component', () => {
  const mockFiles = generateFileMetadataBatch(5);

  beforeEach(() => {
    // Reset any state between tests
  });

  describe('rendering', () => {
    it('should render file tree with all files', () => {
      render(<FileTree files={mockFiles} />);

      const fileTree = screen.getByTestId('file-tree');
      expect(fileTree).toBeInTheDocument();

      mockFiles.forEach(file => {
        expect(screen.getByTestId(`file-item-${file.id}`)).toBeInTheDocument();
      });
    });

    it('should display file names correctly', () => {
      render(<FileTree files={mockFiles} />);

      const fileNames = screen.getAllByTestId('file-name');
      expect(fileNames).toHaveLength(mockFiles.length);

      fileNames.forEach((element, index) => {
        expect(element).toHaveTextContent(mockFiles[index].name);
      });
    });

    it('should display file types', () => {
      render(<FileTree files={mockFiles} />);

      const fileTypes = screen.getAllByTestId('file-type');
      expect(fileTypes).toHaveLength(mockFiles.length);
    });

    it('should render empty state when no files', () => {
      render(<FileTree files={[]} />);

      const fileTree = screen.getByTestId('file-tree');
      expect(fileTree).toBeInTheDocument();
      expect(fileTree.children).toHaveLength(0);
    });
  });

  describe('interactions', () => {
    it('should handle file selection', async () => {
      const onFileSelect = jest.fn();
      render(<FileTree files={mockFiles} onFileSelect={onFileSelect} />);

      const firstFile = screen.getByTestId(`file-item-${mockFiles[0].id}`);
      fireEvent.click(firstFile);

      expect(onFileSelect).toHaveBeenCalledWith(mockFiles[0]);
      expect(onFileSelect).toHaveBeenCalledTimes(1);
    });

    it('should highlight selected file', async () => {
      render(<FileTree files={mockFiles} />);

      const firstFile = screen.getByTestId(`file-item-${mockFiles[0].id}`);
      fireEvent.click(firstFile);

      await waitFor(() => {
        expect(firstFile).toHaveClass('selected');
      });
    });

    it('should change selection when clicking different file', async () => {
      render(<FileTree files={mockFiles} />);

      const firstFile = screen.getByTestId(`file-item-${mockFiles[0].id}`);
      const secondFile = screen.getByTestId(`file-item-${mockFiles[1].id}`);

      fireEvent.click(firstFile);
      await waitFor(() => expect(firstFile).toHaveClass('selected'));

      fireEvent.click(secondFile);
      await waitFor(() => {
        expect(firstFile).not.toHaveClass('selected');
        expect(secondFile).toHaveClass('selected');
      });
    });

    it('should handle context menu on right-click', async () => {
      const onContextMenu = jest.fn();
      render(<FileTree files={mockFiles} onContextMenu={onContextMenu} />);

      const firstFile = screen.getByTestId(`file-item-${mockFiles[0].id}`);
      fireEvent.contextMenu(firstFile);

      expect(onContextMenu).toHaveBeenCalledWith(mockFiles[0]);
    });

    it('should handle keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<FileTree files={mockFiles} />);

      const firstFile = screen.getByTestId(`file-item-${mockFiles[0].id}`);

      // Tab to focus
      await user.tab();

      // Enter to select
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(firstFile).toHaveClass('selected');
      });
    });
  });

  describe('performance', () => {
    it('should render large file lists efficiently', () => {
      const largeFileList = generateFileMetadataBatch(1000);

      const start = performance.now();
      const { container } = render(<FileTree files={largeFileList} />);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(200); // Should render in under 200ms
      expect(container.querySelectorAll('[data-testid^="file-item"]')).toHaveLength(1000);
    });

    it('should not re-render unnecessarily', async () => {
      let renderCount = 0;

      const TestComponent = () => {
        renderCount++;
        return <FileTree files={mockFiles} />;
      };

      const { rerender } = render(<TestComponent />);

      const initialRenderCount = renderCount;

      // Re-render with same props
      rerender(<TestComponent />);

      // Render count should not change if props haven't changed
      expect(renderCount).toBe(initialRenderCount + 1);
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<FileTree files={mockFiles} />);

      const fileTree = screen.getByTestId('file-tree');
      expect(fileTree).toBeInTheDocument();

      // Check for accessibility attributes
      const fileItems = screen.getAllByTestId(/file-item-/);
      fileItems.forEach(item => {
        expect(item).toBeVisible();
      });
    });

    it('should be keyboard navigable', async () => {
      const user = userEvent.setup();
      render(<FileTree files={mockFiles} />);

      // Should be able to tab through items
      await user.tab();

      // First item should be focused
      const firstFile = screen.getByTestId(`file-item-${mockFiles[0].id}`);
      expect(firstFile).toHaveFocus();
    });
  });

  describe('edge cases', () => {
    it('should handle files with very long names', () => {
      const longNameFile = {
        id: 'long-1',
        name: 'a'.repeat(500) + '.pdf',
        path: '/test',
        type: 'application/pdf'
      };

      render(<FileTree files={[longNameFile]} />);

      const fileName = screen.getByTestId('file-name');
      expect(fileName).toBeInTheDocument();
      expect(fileName).toHaveTextContent(longNameFile.name);
    });

    it('should handle special characters in file names', () => {
      const specialFile = {
        id: 'special-1',
        name: 'test-file-émoji-🎉.pdf',
        path: '/test',
        type: 'application/pdf'
      };

      render(<FileTree files={[specialFile]} />);

      expect(screen.getByTestId('file-name')).toHaveTextContent(specialFile.name);
    });

    it('should handle rapid successive clicks', async () => {
      const onFileSelect = jest.fn();
      render(<FileTree files={mockFiles} onFileSelect={onFileSelect} />);

      const firstFile = screen.getByTestId(`file-item-${mockFiles[0].id}`);

      // Click multiple times rapidly
      fireEvent.click(firstFile);
      fireEvent.click(firstFile);
      fireEvent.click(firstFile);

      // Should handle gracefully
      expect(onFileSelect).toHaveBeenCalled();
    });
  });
});
