/**
 * Workflow orchestration service for complex multi-step operations
 */

import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../../shared/utils/logger';
import { WorkflowError } from '../../shared/utils/errors';
import {
  WorkflowDefinition,
  WorkflowContext,
  WorkflowStep,
  RetryPolicy
} from '../../shared/types';
import { DatabaseManager } from '../../database/Database';
import { FileService } from '../file-service/FileService';

export class WorkflowOrchestrator {
  private logger: Logger;
  private db: DatabaseManager;
  private fileService: FileService;
  private activeWorkflows: Map<string, WorkflowContext>;

  constructor(db: DatabaseManager, fileService: FileService) {
    this.logger = new Logger('WorkflowOrchestrator');
    this.db = db;
    this.fileService = fileService;
    this.activeWorkflows = new Map();
  }

  /**
   * Create a new workflow definition
   */
  async createWorkflow(definition: Omit<WorkflowDefinition, 'id'>): Promise<WorkflowDefinition> {
    const workflow: WorkflowDefinition = {
      id: uuidv4(),
      ...definition
    };

    const stmt = this.db.prepare(`
      INSERT INTO workflow_definitions
      (id, name, description, steps, timeout, retry_policy)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      workflow.id,
      workflow.name,
      workflow.description,
      JSON.stringify(workflow.steps),
      workflow.timeout || null,
      workflow.retryPolicy ? JSON.stringify(workflow.retryPolicy) : null
    );

    this.logger.info('Workflow created', { workflowId: workflow.id, name: workflow.name });
    return workflow;
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(workflowId: string, params?: Record<string, any>): Promise<WorkflowContext> {
    this.logger.info('Starting workflow execution', { workflowId });

    // Load workflow definition
    const workflow = await this.getWorkflow(workflowId);
    if (!workflow) {
      throw new WorkflowError(`Workflow not found: ${workflowId}`, workflowId);
    }

    // Create execution context
    const context: WorkflowContext = {
      workflowId,
      executionId: uuidv4(),
      status: 'running',
      results: new Map(),
      errors: [],
      startTime: new Date()
    };

    this.activeWorkflows.set(context.executionId, context);

    // Store execution in database
    this.storeExecution(context);

    try {
      // Execute steps in order, respecting dependencies
      await this.executeSteps(workflow, context, params || {});

      context.status = 'completed';
      context.endTime = new Date();
    } catch (error) {
      context.status = 'failed';
      context.errors.push(error as Error);
      context.endTime = new Date();
      this.logger.error('Workflow execution failed', error as Error, {
        workflowId,
        executionId: context.executionId
      });
    }

    // Update execution in database
    this.updateExecution(context);
    this.activeWorkflows.delete(context.executionId);

    return context;
  }

  /**
   * Execute workflow steps with dependency resolution
   */
  private async executeSteps(
    workflow: WorkflowDefinition,
    context: WorkflowContext,
    params: Record<string, any>
  ): Promise<void> {
    const executedSteps = new Set<string>();
    const pendingSteps = [...workflow.steps];

    while (pendingSteps.length > 0) {
      const readySteps = pendingSteps.filter(step =>
        !step.dependencies ||
        step.dependencies.every(dep => executedSteps.has(dep))
      );

      if (readySteps.length === 0) {
        throw new WorkflowError(
          'Circular dependency detected or unsatisfied dependencies',
          workflow.id
        );
      }

      // Execute ready steps in parallel
      const stepResults = await Promise.allSettled(
        readySteps.map(step => this.executeStep(step, context, params))
      );

      // Process results
      for (let i = 0; i < readySteps.length; i++) {
        const step = readySteps[i];
        const result = stepResults[i];

        if (result.status === 'fulfilled') {
          context.results.set(step.id, result.value);
          executedSteps.add(step.id);
          pendingSteps.splice(pendingSteps.indexOf(step), 1);
        } else {
          if (!step.continueOnError) {
            throw result.reason;
          }
          context.errors.push(result.reason);
          executedSteps.add(step.id);
          pendingSteps.splice(pendingSteps.indexOf(step), 1);
        }
      }
    }
  }

  /**
   * Execute a single workflow step with retry logic
   */
  private async executeStep(
    step: WorkflowStep,
    context: WorkflowContext,
    params: Record<string, any>
  ): Promise<any> {
    context.currentStep = step.id;
    this.logger.info('Executing step', {
      stepId: step.id,
      type: step.type,
      operation: step.operation
    });

    const retryPolicy: RetryPolicy = {
      maxAttempts: 3,
      delayMs: 1000,
      backoffMultiplier: 2
    };

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retryPolicy.maxAttempts; attempt++) {
      try {
        const result = await this.executeStepOperation(step, params, context);
        return result;
      } catch (error) {
        lastError = error as Error;

        if (attempt < retryPolicy.maxAttempts) {
          const delay = retryPolicy.delayMs * Math.pow(retryPolicy.backoffMultiplier || 1, attempt - 1);
          this.logger.warn('Step failed, retrying', {
            stepId: step.id,
            attempt,
            delay,
            error: lastError.message
          });
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new WorkflowError(
      `Step failed after ${retryPolicy.maxAttempts} attempts: ${lastError?.message}`,
      context.workflowId,
      step.id
    );
  }

  /**
   * Execute the actual operation for a step
   */
  private async executeStepOperation(
    step: WorkflowStep,
    params: Record<string, any>,
    context: WorkflowContext
  ): Promise<any> {
    const stepParams = { ...params, ...step.params };

    switch (step.type) {
      case 'file-operation':
        return this.executeFileOperation(step.operation, stepParams);

      case 'parse':
        return this.fileService.parseFile(stepParams.path);

      case 'transform':
        return this.executeTransform(step.operation, stepParams, context);

      case 'custom':
        // Custom operations can be extended here
        throw new WorkflowError(
          `Custom operation not implemented: ${step.operation}`,
          context.workflowId,
          step.id
        );

      default:
        throw new WorkflowError(
          `Unknown step type: ${step.type}`,
          context.workflowId,
          step.id
        );
    }
  }

  /**
   * Execute file operations
   */
  private async executeFileOperation(operation: string, params: Record<string, any>): Promise<any> {
    switch (operation) {
      case 'read':
        return this.fileService.readFile(params.path);

      case 'write':
        return this.fileService.writeFile(params.path, params.content);

      case 'copy':
        return this.fileService.copyFile(params.source, params.destination);

      case 'delete':
        return this.fileService.deleteFile(params.path);

      default:
        throw new Error(`Unknown file operation: ${operation}`);
    }
  }

  /**
   * Execute data transformations
   */
  private async executeTransform(
    operation: string,
    params: Record<string, any>,
    context: WorkflowContext
  ): Promise<any> {
    // Implement transformations like filter, map, reduce, etc.
    // This is a placeholder for custom transformation logic
    return params.data;
  }

  /**
   * Get workflow definition from database
   */
  private async getWorkflow(workflowId: string): Promise<WorkflowDefinition | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM workflow_definitions WHERE id = ?
    `);

    const row = stmt.get(workflowId) as any;
    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      steps: JSON.parse(row.steps),
      timeout: row.timeout,
      retryPolicy: row.retry_policy ? JSON.parse(row.retry_policy) : undefined
    };
  }

  /**
   * Store workflow execution in database
   */
  private storeExecution(context: WorkflowContext): void {
    const stmt = this.db.prepare(`
      INSERT INTO workflow_executions
      (id, workflow_id, status, current_step, results, errors, start_time)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      context.executionId,
      context.workflowId,
      context.status,
      context.currentStep || null,
      JSON.stringify(Array.from(context.results.entries())),
      JSON.stringify(context.errors.map(e => e.message)),
      context.startTime.toISOString()
    );
  }

  /**
   * Update workflow execution in database
   */
  private updateExecution(context: WorkflowContext): void {
    const stmt = this.db.prepare(`
      UPDATE workflow_executions
      SET status = ?, current_step = ?, results = ?, errors = ?, end_time = ?
      WHERE id = ?
    `);

    stmt.run(
      context.status,
      context.currentStep || null,
      JSON.stringify(Array.from(context.results.entries())),
      JSON.stringify(context.errors.map(e => e.message)),
      context.endTime?.toISOString() || null,
      context.executionId
    );
  }

  /**
   * Get workflow execution status
   */
  async getExecutionStatus(executionId: string): Promise<WorkflowContext | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM workflow_executions WHERE id = ?
    `);

    const row = stmt.get(executionId) as any;
    if (!row) return null;

    return {
      workflowId: row.workflow_id,
      executionId: row.id,
      status: row.status,
      currentStep: row.current_step,
      results: new Map(JSON.parse(row.results)),
      errors: JSON.parse(row.errors).map((msg: string) => new Error(msg)),
      startTime: new Date(row.start_time),
      endTime: row.end_time ? new Date(row.end_time) : undefined
    };
  }

  /**
   * Cancel a running workflow
   */
  async cancelWorkflow(executionId: string): Promise<void> {
    const context = this.activeWorkflows.get(executionId);
    if (context) {
      context.status = 'cancelled';
      context.endTime = new Date();
      this.updateExecution(context);
      this.activeWorkflows.delete(executionId);
      this.logger.info('Workflow cancelled', { executionId });
    }
  }
}
