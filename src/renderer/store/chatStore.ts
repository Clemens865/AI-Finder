import { create } from 'zustand';
import { ChatMessage } from '@types/index';

interface ChatStore {
  messages: ChatMessage[];
  isStreaming: boolean;
  currentStreamingMessage: string;
  conversationId: string | null;

  // Actions
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  deleteMessage: (id: string) => void;
  clearMessages: () => void;
  setIsStreaming: (streaming: boolean) => void;
  appendToStreamingMessage: (content: string) => void;
  finalizeStreamingMessage: () => void;
  setConversationId: (id: string | null) => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  isStreaming: false,
  currentStreamingMessage: '',
  conversationId: null,

  addMessage: (message) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          ...message,
          id: generateId(),
          timestamp: new Date(),
        },
      ],
    })),

  updateMessage: (id, updates) =>
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === id ? { ...msg, ...updates } : msg
      ),
    })),

  deleteMessage: (id) =>
    set((state) => ({
      messages: state.messages.filter((msg) => msg.id !== id),
    })),

  clearMessages: () => set({ messages: [], conversationId: null }),

  setIsStreaming: (streaming) => set({ isStreaming: streaming }),

  appendToStreamingMessage: (content) =>
    set((state) => ({
      currentStreamingMessage: state.currentStreamingMessage + content,
    })),

  finalizeStreamingMessage: () => {
    const { currentStreamingMessage } = get();
    if (currentStreamingMessage) {
      get().addMessage({
        role: 'assistant',
        content: currentStreamingMessage,
      });
      set({ currentStreamingMessage: '', isStreaming: false });
    }
  },

  setConversationId: (id) => set({ conversationId: id }),
}));

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
