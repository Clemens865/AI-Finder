import { useRef, useEffect } from 'react';
import { useChatStore } from '@store/chatStore';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { MessageSquare } from 'lucide-react';

export const Chat = () => {
  const { messages, isStreaming, currentStreamingMessage } = useChatStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, currentStreamingMessage]);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Chat
        </h2>
      </div>

      {/* Messages Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4"
      >
        {messages.length === 0 && !currentStreamingMessage && (
          <div className="flex items-center justify-center h-full text-center">
            <div className="max-w-md">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Start a conversation
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Ask questions about your files, search for specific content, or get AI-powered insights.
              </p>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}

        {/* Streaming Message */}
        {isStreaming && currentStreamingMessage && (
          <ChatMessage
            message={{
              id: 'streaming',
              role: 'assistant',
              content: currentStreamingMessage,
              timestamp: new Date(),
              metadata: { processing: true },
            }}
          />
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        <ChatInput />
      </div>
    </div>
  );
};
