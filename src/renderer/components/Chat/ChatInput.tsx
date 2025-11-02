import { useState, useRef, KeyboardEvent } from 'react';
import { useChatStore } from '@store/chatStore';
import { Button, Input } from '@components/UI';
import { Send, StopCircle } from 'lucide-react';

export const ChatInput = () => {
  const [message, setMessage] = useState('');
  const { addMessage, isStreaming, setIsStreaming } = useChatStore();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    if (!message.trim() || isStreaming) return;

    // Add user message
    addMessage({
      role: 'user',
      content: message.trim(),
    });

    // Simulate AI response (in real app, this would call the backend)
    setIsStreaming(true);
    setTimeout(() => {
      addMessage({
        role: 'assistant',
        content: 'This is a simulated response. In production, this would connect to the AI backend.',
      });
      setIsStreaming(false);
    }, 1000);

    // Clear input
    setMessage('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleStop = () => {
    setIsStreaming(false);
  };

  return (
    <div className="flex gap-2">
      <Input
        ref={inputRef}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask about your files..."
        disabled={isStreaming}
        className="flex-1"
      />

      {isStreaming ? (
        <Button variant="danger" onClick={handleStop} leftIcon={<StopCircle className="w-4 h-4" />}>
          Stop
        </Button>
      ) : (
        <Button
          onClick={handleSubmit}
          disabled={!message.trim()}
          leftIcon={<Send className="w-4 h-4" />}
        >
          Send
        </Button>
      )}
    </div>
  );
};
