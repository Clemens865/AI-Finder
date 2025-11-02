import { memo } from 'react';
import { ChatMessage as ChatMessageType } from '@types/index';
import { User, Bot, Clock, FileText } from 'lucide-react';
import { Badge, Card } from '@components/UI';
import { format } from 'date-fns';
import clsx from 'clsx';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'prism-react-renderer';

interface ChatMessageProps {
  message: ChatMessageType;
}

export const ChatMessage = memo(({ message }: ChatMessageProps) => {
  const isUser = message.role === 'user';
  const isProcessing = message.metadata?.processing;

  return (
    <div
      className={clsx('flex gap-3', {
        'flex-row-reverse': isUser,
      })}
    >
      {/* Avatar */}
      <div
        className={clsx(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
          {
            'bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400': isUser,
            'bg-secondary-100 dark:bg-secondary-900 text-secondary-600 dark:text-secondary-400': !isUser,
          }
        )}
      >
        {isUser ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
      </div>

      {/* Message Content */}
      <div className={clsx('flex-1 max-w-3xl', { 'flex flex-col items-end': isUser })}>
        <Card
          variant="outlined"
          padding="sm"
          className={clsx({
            'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800': isUser,
            'bg-gray-50 dark:bg-gray-800/50': !isUser,
          })}
        >
          {/* Message Header */}
          <div className="flex items-center gap-2 mb-2">
            <span className="font-medium text-sm text-gray-900 dark:text-white">
              {isUser ? 'You' : 'AI Assistant'}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {format(new Date(message.timestamp), 'HH:mm')}
            </span>
            {isProcessing && (
              <Badge variant="info" size="sm">
                Processing...
              </Badge>
            )}
          </div>

          {/* Message Body */}
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown
              components={{
                code({ node, inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  return !inline && match ? (
                    <SyntaxHighlighter
                      language={match[1]}
                      PreTag="div"
                      className="rounded-md"
                      {...props}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>

          {/* Metadata */}
          {message.metadata && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400">
              {message.metadata.files && message.metadata.files.length > 0 && (
                <div className="flex items-center gap-2">
                  <FileText className="w-3 h-3" />
                  <span>{message.metadata.files.length} files referenced</span>
                </div>
              )}
              {message.metadata.matches !== undefined && (
                <div className="flex items-center gap-2 mt-1">
                  <span>{message.metadata.matches} matches found</span>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
});

ChatMessage.displayName = 'ChatMessage';
