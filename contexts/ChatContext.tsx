'use client';

import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { ChatMessage, ConversationContext, ContextScope } from '../types/chat';

interface StartConversationOptions {
  originalText?: string;
  initialResponse?: string;
  chapterText?: string;
  bookText?: string;
  chapterTitle?: string;
  existingMessages?: ChatMessage[];
  source?: 'selection' | 'reader';
  initialScope?: ContextScope;
}

interface ChapterContext {
  text: string;
  title: string;
}

interface ReaderContextProvider {
  getChapterContext: () => Promise<ChapterContext | null>;
  getBookText: () => Promise<string | null>;
}

interface ChatContextValue {
  isExpanded: boolean;
  conversation: ConversationContext | null;
  setIsExpanded: (expanded: boolean) => void;
  startConversation: (options: StartConversationOptions) => void;
  openReaderChat: () => Promise<void>;
  registerReaderContextProvider: (provider: ReaderContextProvider | null) => void;
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  setScope: (scope: ContextScope) => void;
  clearConversation: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [conversation, setConversation] = useState<ConversationContext | null>(null);
  const readerContextProviderRef = useRef<ReaderContextProvider | null>(null);

  const startConversation = useCallback((options: StartConversationOptions) => {
    const {
      originalText,
      initialResponse,
      chapterText,
      bookText,
      chapterTitle,
      existingMessages,
      source = 'selection',
      initialScope = 'highlight',
    } = options;

    // If existing messages provided (from popup), use them directly
    if (existingMessages && existingMessages.length > 0) {
      setConversation({
        source,
        originalText,
        chapterText,
        bookText,
        chapterTitle,
        messages: existingMessages,
        scope: initialScope,
      });
      return;
    }

    // Otherwise create a new conversation with the initial response
    const messages: ChatMessage[] = initialResponse ? [{
      id: crypto.randomUUID(),
      role: 'assistant',
      content: initialResponse,
      timestamp: Date.now(),
    }] : [];

    setConversation({
      source,
      originalText,
      chapterText,
      bookText,
      chapterTitle,
      messages,
      scope: initialScope,
    });
  }, []);

  const registerReaderContextProvider = useCallback((provider: ReaderContextProvider | null) => {
    readerContextProviderRef.current = provider;
  }, []);

  const openReaderChat = useCallback(async () => {
    if (conversation) {
      setIsExpanded(true);
      return;
    }

    const provider = readerContextProviderRef.current;
    const chapterContext = await provider?.getChapterContext();

    setConversation({
      source: 'reader',
      originalText: undefined,
      chapterText: chapterContext?.text,
      chapterTitle: chapterContext?.title,
      messages: [],
      scope: 'chapter',
    });
    setIsExpanded(true);

    provider?.getBookText().then((bookText) => {
      if (!bookText) return;
      setConversation(prev => {
        if (!prev || prev.source !== 'reader') return prev;
        return { ...prev, bookText };
      });
    });
  }, [conversation]);

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
        openReaderChat,
        registerReaderContextProvider,
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
