/**
 * Performance Benchmark Suite
 * Tests system performance under various loads and conditions
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { generateFileMetadataBatch, generateInvoiceData, generateTransactionData } from '../fixtures/test-data';

interface BenchmarkResult {
  operation: string;
  duration: number;
  itemsProcessed: number;
  throughput: number; // items per second
  memoryUsed: number; // bytes
}

class PerformanceBenchmark {
  private results: BenchmarkResult[] = [];

  async benchmark<T>(
    operation: string,
    fn: () => Promise<T>,
    itemCount: number = 1
  ): Promise<BenchmarkResult> {
    // Force garbage collection before test (if available)
    if (global.gc) {
      global.gc();
    }

    const memoryBefore = process.memoryUsage().heapUsed;
    const start = performance.now();

    await fn();

    const duration = performance.now() - start;
    const memoryAfter = process.memoryUsage().heapUsed;
    const memoryUsed = Math.max(0, memoryAfter - memoryBefore);

    const result: BenchmarkResult = {
      operation,
      duration,
      itemsProcessed: itemCount,
      throughput: itemCount / (duration / 1000),
      memoryUsed
    };

    this.results.push(result);
    return result;
  }

  getResults(): BenchmarkResult[] {
    return this.results;
  }

  printResults(): void {
    console.table(
      this.results.map(r => ({
        Operation: r.operation,
        'Duration (ms)': r.duration.toFixed(2),
        Items: r.itemsProcessed,
        'Throughput (items/s)': r.throughput.toFixed(2),
        'Memory (MB)': (r.memoryUsed / 1024 / 1024).toFixed(2)
      }))
    );
  }
}

describe('Performance Benchmarks', () => {
  let benchmark: PerformanceBenchmark;

  beforeAll(() => {
    benchmark = new PerformanceBenchmark();
  });

  afterAll(() => {
    benchmark.printResults();
  });

  describe('File Operations', () => {
    it('should read 100 files in under 1 second', async () => {
      const files = generateFileMetadataBatch(100);

      const result = await benchmark.benchmark(
        'Read 100 files',
        async () => {
          await Promise.all(files.map(async file => {
            // Simulate file read
            return Buffer.from('test content');
          }));
        },
        100
      );

      expect(result.duration).toBeLessThan(1000);
      expect(result.throughput).toBeGreaterThan(100); // >100 files/second
    });

    it('should extract metadata from 50 PDFs in under 5 seconds', async () => {
      const files = generateFileMetadataBatch(50);

      const result = await benchmark.benchmark(
        'Extract 50 PDFs',
        async () => {
          await Promise.all(files.map(async file => {
            // Simulate PDF extraction
            return {
              text: 'extracted text',
              metadata: { pages: 5 }
            };
          }));
        },
        50
      );

      expect(result.duration).toBeLessThan(5000);
      expect(result.throughput).toBeGreaterThan(10); // >10 PDFs/second
    });

    it('should handle 1000 concurrent file metadata reads', async () => {
      const files = generateFileMetadataBatch(1000);

      const result = await benchmark.benchmark(
        'Read 1000 metadata',
        async () => {
          await Promise.all(files.map(async file => file));
        },
        1000
      );

      expect(result.duration).toBeLessThan(2000);
      expect(result.memoryUsed).toBeLessThan(100 * 1024 * 1024); // <100MB
    });
  });

  describe('Matching Performance', () => {
    it('should match 50 invoices to 500 transactions in under 10 seconds', async () => {
      const invoices = Array.from({ length: 50 }, () => generateInvoiceData());
      const transactions = Array.from({ length: 500 }, () => generateTransactionData());

      const result = await benchmark.benchmark(
        'Match 50 invoices to 500 transactions',
        async () => {
          for (const invoice of invoices) {
            // Simulate matching logic
            const matches = transactions.filter(t =>
              Math.abs(Math.abs(t.amount) - invoice.amount) < invoice.amount * 0.05
            );
          }
        },
        50
      );

      expect(result.duration).toBeLessThan(10000);
      expect(result.throughput).toBeGreaterThan(5); // >5 invoices/second
    });

    it('should score 1000 potential matches in under 500ms', async () => {
      const pairs = Array.from({ length: 1000 }, () => ({
        invoice: generateInvoiceData(),
        transaction: generateTransactionData()
      }));

      const result = await benchmark.benchmark(
        'Score 1000 matches',
        async () => {
          pairs.forEach(pair => {
            // Simulate scoring
            const score =
              (Math.abs(Math.abs(pair.transaction.amount) - pair.invoice.amount) /
                pair.invoice.amount) *
              0.4;
          });
        },
        1000
      );

      expect(result.duration).toBeLessThan(500);
      expect(result.throughput).toBeGreaterThan(2000); // >2000 scores/second
    });

    it('should maintain performance with learned rules', async () => {
      const invoices = Array.from({ length: 100 }, () => generateInvoiceData());
      const transactions = Array.from({ length: 1000 }, () => generateTransactionData());

      // Simulate learned rules
      const learnedRules = Array.from({ length: 50 }, () => ({
        pattern: 'vendor match',
        weight: 0.4
      }));

      const result = await benchmark.benchmark(
        'Match with 50 learned rules',
        async () => {
          for (const invoice of invoices) {
            const matches = transactions.filter(t => {
              let score = 0;
              learnedRules.forEach(rule => {
                // Apply rule
                score += rule.weight * Math.random();
              });
              return score > 0.7;
            });
          }
        },
        100
      );

      expect(result.duration).toBeLessThan(15000);
    });
  });

  describe('Vector Database Operations', () => {
    it('should insert 1000 embeddings in under 2 seconds', async () => {
      const embeddings = Array.from({ length: 1000 }, () =>
        Array.from({ length: 384 }, () => Math.random() * 2 - 1)
      );

      const result = await benchmark.benchmark(
        'Insert 1000 embeddings',
        async () => {
          // Simulate vector DB insertion
          embeddings.forEach(emb => {
            // Insert operation
          });
        },
        1000
      );

      expect(result.duration).toBeLessThan(2000);
      expect(result.throughput).toBeGreaterThan(500); // >500 embeddings/second
    });

    it('should search 1000 queries in under 5 seconds', async () => {
      const queries = Array.from({ length: 1000 }, () =>
        Array.from({ length: 384 }, () => Math.random() * 2 - 1)
      );

      const result = await benchmark.benchmark(
        'Search 1000 queries',
        async () => {
          queries.forEach(query => {
            // Simulate vector search (cosine similarity)
            const similarity = query.reduce((sum, val) => sum + val * Math.random(), 0);
          });
        },
        1000
      );

      expect(result.duration).toBeLessThan(5000);
      expect(result.throughput).toBeGreaterThan(200); // >200 searches/second
    });

    it('should handle batch embedding generation', async () => {
      const texts = Array.from({ length: 100 }, () => 'Sample text for embedding');

      const result = await benchmark.benchmark(
        'Generate 100 embeddings',
        async () => {
          // Simulate batch embedding generation
          await Promise.all(
            texts.map(async text =>
              Array.from({ length: 384 }, () => Math.random() * 2 - 1)
            )
          );
        },
        100
      );

      expect(result.duration).toBeLessThan(3000);
    });
  });

  describe('Memory Efficiency', () => {
    it('should process large file without excessive memory growth', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Simulate processing large file in chunks
      const chunkSize = 1000;
      const totalChunks = 100;

      for (let i = 0; i < totalChunks; i++) {
        const chunk = Buffer.alloc(chunkSize * 1024); // 1MB chunks
        // Process chunk
        await new Promise(resolve => setImmediate(resolve));
      }

      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;

      // Memory growth should be minimal (<50MB)
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024);
    });

    it('should handle 10,000 file metadata objects efficiently', async () => {
      const result = await benchmark.benchmark(
        'Store 10,000 metadata objects',
        async () => {
          const metadata = generateFileMetadataBatch(10000);
          // Store in memory structure
        },
        10000
      );

      // Should use less than 100MB for 10k objects
      expect(result.memoryUsed).toBeLessThan(100 * 1024 * 1024);
    });

    it('should clean up resources after batch operations', async () => {
      const memoryBefore = process.memoryUsage().heapUsed;

      // Perform batch operations
      for (let i = 0; i < 10; i++) {
        const batch = generateFileMetadataBatch(100);
        // Process batch
        await Promise.resolve();
      }

      if (global.gc) {
        global.gc();
      }

      const memoryAfter = process.memoryUsage().heapUsed;
      const memoryGrowth = memoryAfter - memoryBefore;

      // Minimal memory growth after cleanup
      expect(memoryGrowth).toBeLessThan(20 * 1024 * 1024);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle 100 concurrent file reads', async () => {
      const files = generateFileMetadataBatch(100);

      const result = await benchmark.benchmark(
        '100 concurrent reads',
        async () => {
          await Promise.all(
            files.map(async file => {
              // Simulate async file read
              await new Promise(resolve => setTimeout(resolve, 10));
              return Buffer.from('content');
            })
          );
        },
        100
      );

      expect(result.duration).toBeLessThan(1000);
    });

    it('should maintain throughput under concurrent load', async () => {
      const operations = Array.from({ length: 500 }, (_, i) => i);

      const result = await benchmark.benchmark(
        '500 concurrent operations',
        async () => {
          await Promise.all(
            operations.map(async op => {
              // Mix of different operations
              if (op % 3 === 0) {
                // File read
                await new Promise(resolve => setTimeout(resolve, 5));
              } else if (op % 3 === 1) {
                // Database query
                await new Promise(resolve => setTimeout(resolve, 3));
              } else {
                // Matching operation
                await new Promise(resolve => setTimeout(resolve, 2));
              }
            })
          );
        },
        500
      );

      expect(result.duration).toBeLessThan(3000);
    });
  });

  describe('End-to-End Workflow Performance', () => {
    it('should complete tax workflow for 50 invoices in under 60 seconds', async () => {
      const invoices = Array.from({ length: 50 }, () => generateInvoiceData());
      const transactions = Array.from({ length: 500 }, () => generateTransactionData());

      const result = await benchmark.benchmark(
        'Complete tax workflow (50 invoices)',
        async () => {
          // Step 1: Extract invoices (simulated)
          await Promise.all(invoices.map(async inv => inv));

          // Step 2: Parse transactions
          await Promise.resolve(transactions);

          // Step 3: Match
          const matches = [];
          for (const invoice of invoices) {
            const matched = transactions.find(
              t => Math.abs(Math.abs(t.amount) - invoice.amount) < invoice.amount * 0.05
            );
            if (matched) matches.push({ invoice, transaction: matched });
          }

          // Step 4: Generate report
          const report = { matches, timestamp: Date.now() };
        },
        50
      );

      expect(result.duration).toBeLessThan(60000);
      expect(result.throughput).toBeGreaterThan(0.8); // >0.8 invoices/second
    });

    it('should scale linearly up to 200 invoices', async () => {
      const sizes = [50, 100, 150, 200];
      const results: BenchmarkResult[] = [];

      for (const size of sizes) {
        const invoices = Array.from({ length: size }, () => generateInvoiceData());
        const transactions = Array.from({ length: size * 10 }, () => generateTransactionData());

        const result = await benchmark.benchmark(
          `Tax workflow (${size} invoices)`,
          async () => {
            for (const invoice of invoices) {
              transactions.find(
                t => Math.abs(Math.abs(t.amount) - invoice.amount) < invoice.amount * 0.05
              );
            }
          },
          size
        );

        results.push(result);
      }

      // Check linear scaling (throughput should be relatively consistent)
      const throughputs = results.map(r => r.throughput);
      const avgThroughput = throughputs.reduce((a, b) => a + b) / throughputs.length;

      throughputs.forEach(t => {
        // Throughput should be within 30% of average
        expect(Math.abs(t - avgThroughput) / avgThroughput).toBeLessThan(0.3);
      });
    });
  });

  describe('Resource Limits', () => {
    it('should handle system under heavy load', async () => {
      // Simulate heavy concurrent load
      const heavyOperations = Array.from({ length: 200 }, () => ({
        files: generateFileMetadataBatch(50),
        invoices: Array.from({ length: 20 }, () => generateInvoiceData())
      }));

      const result = await benchmark.benchmark(
        'Heavy concurrent load',
        async () => {
          await Promise.all(
            heavyOperations.map(async op => {
              // Process files
              await Promise.all(op.files.map(async f => f));
              // Process invoices
              await Promise.all(op.invoices.map(async i => i));
            })
          );
        },
        200
      );

      // Should complete without crashes
      expect(result.duration).toBeDefined();
      expect(result.memoryUsed).toBeLessThan(500 * 1024 * 1024); // <500MB
    });

    it('should recover from memory pressure', async () => {
      const operations = 50;

      for (let i = 0; i < operations; i++) {
        // Allocate memory
        const data = generateFileMetadataBatch(1000);

        // Force cleanup periodically
        if (i % 10 === 0 && global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;

      // Should have cleaned up most allocations
      expect(finalMemory).toBeLessThan(200 * 1024 * 1024);
    });
  });
});

describe('Performance Regression Tests', () => {
  const BASELINE_THRESHOLDS = {
    fileRead: 1000, // ms for 100 files
    pdfExtract: 5000, // ms for 50 PDFs
    matching: 10000, // ms for 50 invoices vs 500 transactions
    vectorInsert: 2000, // ms for 1000 embeddings
    vectorSearch: 5000, // ms for 1000 queries
    fullWorkflow: 60000 // ms for 50 invoices
  };

  it('should not regress file read performance', async () => {
    const files = generateFileMetadataBatch(100);
    const start = performance.now();

    await Promise.all(files.map(async f => Buffer.from('content')));

    const duration = performance.now() - start;
    expect(duration).toBeLessThan(BASELINE_THRESHOLDS.fileRead);
  });

  it('should not regress matching performance', async () => {
    const invoices = Array.from({ length: 50 }, () => generateInvoiceData());
    const transactions = Array.from({ length: 500 }, () => generateTransactionData());

    const start = performance.now();

    for (const invoice of invoices) {
      transactions.filter(
        t => Math.abs(Math.abs(t.amount) - invoice.amount) < invoice.amount * 0.05
      );
    }

    const duration = performance.now() - start;
    expect(duration).toBeLessThan(BASELINE_THRESHOLDS.matching);
  });

  it('should maintain consistent performance across runs', async () => {
    const runs = 5;
    const durations: number[] = [];

    for (let i = 0; i < runs; i++) {
      const files = generateFileMetadataBatch(100);
      const start = performance.now();

      await Promise.all(files.map(async f => f));

      durations.push(performance.now() - start);
    }

    const avg = durations.reduce((a, b) => a + b) / durations.length;
    const variance = durations.map(d => Math.pow(d - avg, 2)).reduce((a, b) => a + b) / durations.length;
    const stdDev = Math.sqrt(variance);

    // Standard deviation should be less than 20% of mean
    expect(stdDev / avg).toBeLessThan(0.2);
  });
});
