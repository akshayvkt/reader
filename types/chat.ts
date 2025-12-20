export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export type ContextScope = 'highlight' | 'chapter' | 'book';

export interface ConversationContext {
  originalText: string;
  chapterText?: string;
  bookText?: string;
  chapterTitle?: string;
  messages: ChatMessage[];
  scope: ContextScope;
}

export type SimplifyMode = 'explain' | 'eli5' | 'followup';
