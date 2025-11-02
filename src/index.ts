/**
 * Main entry point for Intelligent Finder Service Layer
 */

import { ServiceManager } from './services';
import { join } from 'path';

// Example usage
async function main() {
  const serviceManager = new ServiceManager({
    databasePath: join(__dirname, '../data/intelligent-finder.db'),
    backupDirectory: join(__dirname, '../data/backups'),
    maxConcurrentOperations: 5
  });

  await serviceManager.start();

  // Example: Read and parse a file
  const readResult = await serviceManager.fileService.readFile('/path/to/file.pdf');
  if (readResult.success) {
    console.log('File read successfully:', readResult.data?.metadata);

    // Parse the file
    const parseResult = await serviceManager.fileService.parseFile('/path/to/file.pdf');
    if (parseResult.success) {
      console.log('File parsed successfully:', parseResult.data?.extractedText?.substring(0, 100));
    }
  }

  // Example: Create a workflow
  const workflow = await serviceManager.workflowService.createWorkflow({
    name: 'Process Documents',
    description: 'Read, parse, and backup documents',
    steps: [
      {
        id: 'read',
        type: 'file-operation',
        operation: 'read',
        params: { path: '/path/to/document.pdf' }
      },
      {
        id: 'parse',
        type: 'parse',
        operation: 'parse',
        params: { path: '/path/to/document.pdf' },
        dependencies: ['read']
      },
      {
        id: 'backup',
        type: 'file-operation',
        operation: 'backup',
        params: { files: ['/path/to/document.pdf'] },
        dependencies: ['parse']
      }
    ]
  });

  console.log('Workflow created:', workflow.id);

  // Example: Generate a report
  await serviceManager.reportService.generateReport({
    format: 'excel',
    title: 'File Analysis Report',
    data: [
      { fileName: 'document1.pdf', size: 1024, pages: 10 },
      { fileName: 'document2.xlsx', size: 2048, sheets: 3 }
    ],
    output: join(__dirname, '../reports/analysis.xlsx')
  });

  // Check health status
  const health = await serviceManager.getHealthStatus();
  console.log('Service health:', health);

  // Cleanup
  process.on('SIGINT', async () => {
    console.log('Shutting down...');
    await serviceManager.stop();
    process.exit(0);
  });
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { ServiceManager };
