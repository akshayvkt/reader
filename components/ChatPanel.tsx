'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useChat } from '../contexts/ChatContext';
import { ChatMessage } from '../types/chat';

export default function ChatPanel() {
  const { isExpanded, conversation, setIsExpanded, addMessage } = useChat();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isExpanded) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isExpanded]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || sending || !conversation) return;

    const userMessage: Omit<ChatMessage, 'id' | 'timestamp'> = {
      role: 'user',
      content: input.trim(),
    };

    addMessage(userMessage);
    setInput('');
    setSending(true);

    try {
      const response = await fetch('/api/simplify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: userMessage.content,
          mode: 'followup',
          originalText: conversation.originalText,
          conversationHistory: conversation.messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      addMessage({
        role: 'assistant',
        content: data.simplified || 'Unable to respond',
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      addMessage({
        role: 'assistant',
        content: 'Failed to get response. Please try again.',
      });
    }
    setSending(false);
  }, [input, sending, conversation, addMessage]);

  if (!isExpanded || !conversation) return null;

  return (
    <div
      className="h-full flex flex-col"
      style={{ background: 'var(--surface)', borderLeft: '1px solid var(--border)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div>
          <h3 className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            Chat
          </h3>
          <p className="text-xs mt-0.5 truncate max-w-[200px]" style={{ color: 'var(--foreground-muted)' }}>
            {conversation.originalText.slice(0, 50)}...
          </p>
        </div>
        <button
          onClick={() => setIsExpanded(false)}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--foreground-muted)' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--background-muted)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Original text context */}
      <div
        className="px-4 py-3"
        style={{ background: 'var(--background)', borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div className="text-xs font-medium mb-1" style={{ color: 'var(--accent)' }}>
          Selected text:
        </div>
        <p className="text-sm italic" style={{ color: 'var(--foreground-muted)' }}>
          &ldquo;{conversation.originalText}&rdquo;
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {conversation.messages.map((msg) => (
          <div key={msg.id}>
            <div className="text-xs font-medium mb-1" style={{ color: 'var(--accent)' }}>
              {msg.role === 'user' ? 'You:' : 'Reader:'}
            </div>
            <div
              className="text-sm leading-relaxed"
              style={{ color: 'var(--foreground)' }}
            >
              <ReactMarkdown
                components={{
                  strong: ({ children }) => <strong className="font-medium">{children}</strong>,
                  em: ({ children }) => <em className="italic">{children}</em>,
                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                }}
              >
                {msg.content}
              </ReactMarkdown>
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--accent)' }} />
            <span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div
        className="px-4 py-3"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Ask a question..."
            className="flex-1 px-3 py-2 text-sm rounded-lg outline-none transition-colors"
            style={{
              background: 'var(--background)',
              color: 'var(--foreground)',
              border: '1px solid var(--border)',
            }}
            disabled={sending}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            className="px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
            style={{ background: 'var(--accent)', color: 'white' }}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
