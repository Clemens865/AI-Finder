/**
 * File Service exports
 * Main entry point for file operations
 */

export { FileService, FileServiceOptions } from './FileService';
export { FileMetadataManager } from './managers/FileMetadata';
export { BackupManager, BackupOptions, BackupInfo } from './managers/BackupManager';
export { OperationHistory } from './operations/OperationHistory';
export { BatchOperations, BatchOperation, BatchResult } from './operations/BatchOperations';
export { ParserRegistry, FileParser } from './parsers/ParserRegistry';
export { PDFParser } from './parsers/PDFParser';
export { ExcelParser } from './parsers/ExcelParser';
export { CSVParser } from './parsers/CSVParser';
export { ImageParser } from './parsers/ImageParser';
export { TextParser } from './parsers/TextParser';
export { JSONParser } from './parsers/JSONParser';
