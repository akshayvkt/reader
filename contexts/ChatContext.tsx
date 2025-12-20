'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ChatMessage, ConversationContext, ContextScope } from '../types/chat';

interface StartConversationOptions {
  originalText: string;
  initialResponse: string;
  chapterText?: string;
  bookText?: string;
  chapterTitle?: string;
  existingMessages?: ChatMessage[];
}

interface ChatContextValue {
  isExpanded: boolean;
  conversation: ConversationContext | null;
  setIsExpanded: (expanded: boolean) => void;
  startConversation: (options: StartConversationOptions) => void;
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  setScope: (scope: ContextScope) => void;
  clearConversation: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [conversation, setConversation] = useState<ConversationContext | null>(null);

  const startConversation = useCallback((options: StartConversationOptions) => {
    const { originalText, initialResponse, chapterText, bookText, chapterTitle, existingMessages } = options;

    // If existing messages provided (from popup), use them directly
    if (existingMessages && existingMessages.length > 0) {
      setConversation({
        originalText,
        chapterText,
        bookText,
        chapterTitle,
        messages: existingMessages,
        scope: 'highlight', // Default to highlight
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
      chapterText,
      bookText,
      chapterTitle,
      messages: [initialMessage],
      scope: 'highlight', // Default to highlight
    });
  }, []);

  const setScope = useCallback((scope: ContextScope) => {
    setConversation(prev => {
      if (!prev) return null;
      return { ...prev, scope };
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
        setScope,
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
