export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ConversationContext {
  originalText: string;
  bookContext?: string;
  messages: ChatMessage[];
}

export type SimplifyMode = 'explain' | 'eli5' | 'followup';
