/**
 * Stream Handler
 *
 * Manages streaming responses from LLM providers with buffering,
 * rate limiting, and event emission.
 */

import { LLMStreamChunk, LLMProvider } from './types';

/**
 * Stream event types
 */
export enum StreamEventType {
  CHUNK = 'chunk',
  START = 'start',
  END = 'end',
  ERROR = 'error',
  CANCEL = 'cancel'
}

/**
 * Stream event
 */
export interface StreamEvent {
  type: StreamEventType;
  data?: any;
  timestamp: number;
}

/**
 * Stream listener callback
 */
export type StreamListener = (event: StreamEvent) => void;

/**
 * Stream options
 */
export interface StreamOptions {
  bufferSize?: number;
  debounceMs?: number;
  onChunk?: (chunk: LLMStreamChunk) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
}

/**
 * StreamHandler - Manage streaming LLM responses
 */
export class StreamHandler {
  private listeners: Map<string, Set<StreamListener>>;
  private activeStreams: Map<string, StreamState>;
  private readonly defaultBufferSize = 10;
  private readonly defaultDebounceMs = 50;

  constructor() {
    this.listeners = new Map();
    this.activeStreams = new Map();
  }

  /**
   * Start a new stream
   */
  async startStream(
    streamId: string,
    generator: AsyncGenerator<LLMStreamChunk>,
    options: StreamOptions = {}
  ): Promise<string> {
    // Create stream state
    const state: StreamState = {
      id: streamId,
      buffer: [],
      fullText: '',
      chunkCount: 0,
      startTime: Date.now(),
      lastChunkTime: Date.now(),
      completed: false,
      cancelled: false,
      error: null,
      options
    };

    this.activeStreams.set(streamId, state);

    // Emit start event
    this.emitEvent(streamId, {
      type: StreamEventType.START,
      timestamp: Date.now()
    });

    try {
      // Process stream
      for await (const chunk of generator) {
        // Check if cancelled
        if (state.cancelled) {
          this.emitEvent(streamId, {
            type: StreamEventType.CANCEL,
            timestamp: Date.now()
          });
          break;
        }

        // Update state
        state.chunkCount++;
        state.lastChunkTime = Date.now();
        state.fullText += chunk.content;

        // Add to buffer
        state.buffer.push(chunk);
        if (state.buffer.length > (options.bufferSize || this.defaultBufferSize)) {
          state.buffer.shift();
        }

        // Emit chunk event
        this.emitEvent(streamId, {
          type: StreamEventType.CHUNK,
          data: chunk,
          timestamp: Date.now()
        });

        // Call chunk callback
        if (options.onChunk) {
          options.onChunk(chunk);
        }

        // Handle done
        if (chunk.done) {
          state.completed = true;
          break;
        }

        // Debounce if configured
        if (options.debounceMs) {
          await this.delay(options.debounceMs);
        }
      }

      // Emit completion
      if (state.completed && !state.cancelled) {
        this.emitEvent(streamId, {
          type: StreamEventType.END,
          data: { fullText: state.fullText, chunkCount: state.chunkCount },
          timestamp: Date.now()
        });

        if (options.onComplete) {
          options.onComplete(state.fullText);
        }
      }

      return state.fullText;

    } catch (error) {
      state.error = error as Error;

      this.emitEvent(streamId, {
        type: StreamEventType.ERROR,
        data: error,
        timestamp: Date.now()
      });

      if (options.onError) {
        options.onError(error as Error);
      }

      throw error;
    }
  }

  /**
   * Cancel an active stream
   */
  cancelStream(streamId: string): void {
    const state = this.activeStreams.get(streamId);
    if (state && !state.completed) {
      state.cancelled = true;
    }
  }

  /**
   * Get stream state
   */
  getStreamState(streamId: string): StreamState | null {
    return this.activeStreams.get(streamId) || null;
  }

  /**
   * Subscribe to stream events
   */
  subscribe(streamId: string, listener: StreamListener): () => void {
    if (!this.listeners.has(streamId)) {
      this.listeners.set(streamId, new Set());
    }

    this.listeners.get(streamId)!.add(listener);

    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(streamId);
      if (listeners) {
        listeners.delete(listener);
      }
    };
  }

  /**
   * Emit event to listeners
   */
  private emitEvent(streamId: string, event: StreamEvent): void {
    const listeners = this.listeners.get(streamId);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error('Stream listener error:', error);
        }
      });
    }
  }

  /**
   * Clean up completed streams
   */
  cleanup(maxAge: number = 3600000): void {
    const now = Date.now();

    for (const [streamId, state] of this.activeStreams.entries()) {
      if (state.completed || state.cancelled || state.error) {
        const age = now - state.startTime;
        if (age > maxAge) {
          this.activeStreams.delete(streamId);
          this.listeners.delete(streamId);
        }
      }
    }
  }

  /**
   * Get statistics for all streams
   */
  getStatistics(): StreamStatistics {
    const states = Array.from(this.activeStreams.values());

    return {
      totalStreams: states.length,
      activeStreams: states.filter(s => !s.completed && !s.cancelled && !s.error).length,
      completedStreams: states.filter(s => s.completed).length,
      cancelledStreams: states.filter(s => s.cancelled).length,
      erroredStreams: states.filter(s => s.error !== null).length,
      totalChunks: states.reduce((sum, s) => sum + s.chunkCount, 0),
      averageChunksPerStream: states.length > 0
        ? states.reduce((sum, s) => sum + s.chunkCount, 0) / states.length
        : 0
    };
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create a readable stream from chunks
   */
  createReadableStream(
    streamId: string,
    generator: AsyncGenerator<LLMStreamChunk>
  ): ReadableStream<string> {
    return new ReadableStream({
      start: async (controller) => {
        try {
          for await (const chunk of generator) {
            controller.enqueue(chunk.content);

            if (chunk.done) {
              controller.close();
              break;
            }
          }
        } catch (error) {
          controller.error(error);
        }
      },
      cancel: () => {
        this.cancelStream(streamId);
      }
    });
  }
}

/**
 * Stream state
 */
interface StreamState {
  id: string;
  buffer: LLMStreamChunk[];
  fullText: string;
  chunkCount: number;
  startTime: number;
  lastChunkTime: number;
  completed: boolean;
  cancelled: boolean;
  error: Error | null;
  options: StreamOptions;
}

/**
 * Stream statistics
 */
interface StreamStatistics {
  totalStreams: number;
  activeStreams: number;
  completedStreams: number;
  cancelledStreams: number;
  erroredStreams: number;
  totalChunks: number;
  averageChunksPerStream: number;
}
