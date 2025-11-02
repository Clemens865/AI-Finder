import { useCallback } from 'react';
import { useChatStore } from '@store/chatStore';
import { useNotificationStore } from '@store/notificationStore';

export const useChat = () => {
  const {
    addMessage,
    setIsStreaming,
    appendToStreamingMessage,
    finalizeStreamingMessage,
  } = useChatStore();
  const { addNotification } = useNotificationStore();

  const sendMessage = useCallback(
    async (content: string) => {
      try {
        // Add user message
        addMessage({
          role: 'user',
          content,
        });

        // Start streaming response
        setIsStreaming(true);

        // In production, this would call the AI backend
        // For now, simulate streaming
        const response = 'This is a simulated AI response. In production, this would connect to the Anthropic API.';
        const words = response.split(' ');

        for (const word of words) {
          await new Promise((resolve) => setTimeout(resolve, 50));
          appendToStreamingMessage(word + ' ');
        }

        finalizeStreamingMessage();
      } catch (error) {
        setIsStreaming(false);
        addNotification({
          type: 'error',
          title: 'Chat Error',
          message: error instanceof Error ? error.message : 'Failed to send message',
        });
      }
    },
    [addMessage, setIsStreaming, appendToStreamingMessage, finalizeStreamingMessage, addNotification]
  );

  const stopStreaming = useCallback(() => {
    setIsStreaming(false);
    finalizeStreamingMessage();
  }, [setIsStreaming, finalizeStreamingMessage]);

  return {
    sendMessage,
    stopStreaming,
  };
};
