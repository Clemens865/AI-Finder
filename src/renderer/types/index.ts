/**
 * Core type definitions for Intelligent Finder
 */

export interface FileNode {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: Date;
  children?: FileNode[];
  isExpanded?: boolean;
  matchScore?: number;
  matches?: SearchMatch[];
}

export interface SearchMatch {
  line: number;
  column: number;
  text: string;
  context: string;
  score: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    files?: string[];
    matches?: number;
    processing?: boolean;
  };
}

export interface MatchResult {
  file: string;
  matches: SearchMatch[];
  totalScore: number;
  preview?: string;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'auto';
  apiKey?: string;
  maxResults: number;
  searchDepth: number;
  fileTypes: string[];
  excludePatterns: string[];
  notifications: {
    enabled: boolean;
    sound: boolean;
  };
}

export interface NotificationOptions {
  id?: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface LoadingState {
  isLoading: boolean;
  message?: string;
  progress?: number;
}
