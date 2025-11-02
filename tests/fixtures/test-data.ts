/**
 * Test Data Generators and Fixtures
 * Centralized test data for consistent testing across all test suites
 */

// Use custom nanoid implementation for tests to avoid ESM issues
const customNanoid = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

export interface FileMetadata {
  id: string;
  path: string;
  name: string;
  type: string;
  size: number;
  checksum: string;
  createdAt: Date;
  modifiedAt: Date;
  extractedData?: any;
}

export interface Match {
  id: string;
  sourceId: string;
  targetId: string;
  confidence: number;
  matchType: string;
  reasoning: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface WorkflowExecution {
  id: string;
  workflowType: string;
  status: 'running' | 'completed' | 'failed' | 'paused';
  input: Record<string, any>;
  output?: Record<string, any>;
  progress: number;
  startedAt: Date;
  completedAt?: Date;
}

/**
 * Generate fake file metadata
 */
export const generateFileMetadata = (overrides: Partial<FileMetadata> = {}): FileMetadata => ({
  id: customNanoid(),
  path: `/test/documents/${customNanoid()}.pdf`,
  name: `test-document-${customNanoid()}.pdf`,
  type: 'application/pdf',
  size: Math.floor(Math.random() * 1000000) + 10000,
  checksum: `sha256-${customNanoid()}`,
  createdAt: new Date('2024-01-01'),
  modifiedAt: new Date('2024-01-15'),
  ...overrides
});

/**
 * Generate batch of file metadata
 */
export const generateFileMetadataBatch = (count: number): FileMetadata[] => {
  return Array.from({ length: count }, () => generateFileMetadata());
};

/**
 * Generate invoice data
 */
export const generateInvoiceData = () => ({
  invoiceNumber: `INV-${Math.floor(Math.random() * 10000)}`,
  date: new Date('2024-01-15'),
  vendor: 'Test Vendor Inc.',
  amount: Math.floor(Math.random() * 10000) + 100,
  currency: 'USD',
  items: [
    {
      description: 'Test Service',
      quantity: 1,
      unitPrice: 500,
      total: 500
    }
  ]
});

/**
 * Generate transaction data
 */
export const generateTransactionData = () => ({
  id: customNanoid(),
  date: new Date('2024-01-16'),
  description: 'PAYMENT TO TEST VENDOR',
  amount: -Math.floor(Math.random() * 10000) - 100,
  currency: 'USD',
  category: 'Business Expenses'
});

/**
 * Generate match data
 */
export const generateMatch = (overrides: Partial<Match> = {}): Match => ({
  id: customNanoid(),
  sourceId: customNanoid(),
  targetId: customNanoid(),
  confidence: Math.random() * 0.3 + 0.7, // 0.7-1.0
  matchType: 'invoice-transaction',
  reasoning: 'Matched on vendor name and amount within 5% tolerance',
  status: 'pending',
  ...overrides
});

/**
 * Generate workflow execution
 */
export const generateWorkflowExecution = (
  overrides: Partial<WorkflowExecution> = {}
): WorkflowExecution => ({
  id: customNanoid(),
  workflowType: 'tax-workflow',
  status: 'running',
  input: {
    invoicesPath: '/test/invoices',
    transactionsPath: '/test/transactions.csv'
  },
  progress: 0.5,
  startedAt: new Date(),
  ...overrides
});

/**
 * Mock PDF content
 */
export const mockPDFContent = `
INVOICE

Invoice No: INV-12345
Date: January 15, 2024

Bill To:
Test Company
123 Test Street
Test City, TC 12345

From:
Vendor Inc.
456 Vendor Avenue
Vendor City, VC 67890

Description                 Qty    Unit Price    Total
Software License            1      $500.00       $500.00
Support Services           12      $50.00        $600.00

                           Subtotal:          $1,100.00
                           Tax (10%):         $110.00
                           Total:             $1,210.00

Payment Due: February 15, 2024
`;

/**
 * Mock CSV content
 */
export const mockCSVContent = `Date,Description,Amount,Category
2024-01-16,"PAYMENT TO VENDOR INC",-1210.00,"Business Expenses"
2024-01-17,"CLIENT PAYMENT",5000.00,"Revenue"
2024-01-18,"OFFICE SUPPLIES",-150.00,"Office Expenses"
`;

/**
 * Mock Excel data
 */
export const mockExcelData = [
  { Date: '2024-01-16', Description: 'PAYMENT TO VENDOR INC', Amount: -1210, Category: 'Business Expenses' },
  { Date: '2024-01-17', Description: 'CLIENT PAYMENT', Amount: 5000, Category: 'Revenue' },
  { Date: '2024-01-18', Description: 'OFFICE SUPPLIES', Amount: -150, Category: 'Office Expenses' }
];

/**
 * Test file paths
 */
export const TEST_PATHS = {
  invoices: '/test/data/invoices',
  transactions: '/test/data/transactions.csv',
  output: '/test/output',
  temp: '/test/temp'
};

/**
 * Mock embeddings (384-dimensional vector)
 */
export const generateMockEmbedding = (): number[] => {
  return Array.from({ length: 384 }, () => Math.random() * 2 - 1);
};
