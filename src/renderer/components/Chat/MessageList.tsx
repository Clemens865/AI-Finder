import React from 'react';
import { Message } from './ChatInterface';

interface MessageListProps {
  messages: Message[];
}

export const MessageList: React.FC<MessageListProps> = ({ messages }) => {
  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const getMessageStyle = (role: Message['role']) => {
    switch (role) {
      case 'user':
        return 'bg-blue-900/30 border-blue-700 ml-8';
      case 'assistant':
        return 'bg-gray-700/50 border-gray-600 mr-8';
      case 'system':
        return 'bg-gray-800/50 border-gray-700 mx-8 text-center';
      default:
        return 'bg-gray-700 border-gray-600';
    }
  };

  const getMessageIcon = (role: Message['role']) => {
    switch (role) {
      case 'user':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
          </svg>
        );
      case 'assistant':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
            <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
          </svg>
        );
      case 'system':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  return (
    <div className="p-4 space-y-4">
      {messages.map((message) => (
        <div key={message.id} className="flex flex-col">
          <div
            className={`
              rounded-lg border p-3
              ${getMessageStyle(message.role)}
            `}
          >
            <div className="flex items-start space-x-3">
              {message.role !== 'system' && (
                <div className="flex-shrink-0 mt-1 text-gray-400">
                  {getMessageIcon(message.role)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-200 whitespace-pre-wrap break-words">
                  {message.content}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  {formatTime(message.timestamp)}
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
