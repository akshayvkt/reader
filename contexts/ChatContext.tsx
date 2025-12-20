'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ChatMessage, ConversationContext } from '../types/chat';

interface ChatContextValue {
  isExpanded: boolean;
  conversation: ConversationContext | null;
  setIsExpanded: (expanded: boolean) => void;
  startConversation: (originalText: string, initialResponse: string, bookContext?: string, existingMessages?: ChatMessage[]) => void;
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  clearConversation: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [conversation, setConversation] = useState<ConversationContext | null>(null);

  const startConversation = useCallback((originalText: string, initialResponse: string, bookContext?: string, existingMessages?: ChatMessage[]) => {
    // If existing messages provided (from popup), use them directly
    if (existingMessages && existingMessages.length > 0) {
      setConversation({
        originalText,
        bookContext,
        messages: existingMessages,
      });
      return;
    }

    // Otherwise create a new conversation with the initial response
    const initialMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: initialResponse,
      timestamp: Date.now(),
    };

    setConversation({
      originalText,
      bookContext,
      messages: [initialMessage],
    });
  }, []);

  const addMessage = useCallback((message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };

    setConversation(prev => {
      if (!prev) return null;
      return {
        ...prev,
        messages: [...prev.messages, newMessage],
      };
    });
  }, []);

  const clearConversation = useCallback(() => {
    setConversation(null);
    setIsExpanded(false);
  }, []);

  return (
    <ChatContext.Provider
      value={{
        isExpanded,
        conversation,
        setIsExpanded,
        startConversation,
        addMessage,
        clearConversation,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
