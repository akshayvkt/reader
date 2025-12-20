'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useChat } from '../contexts/ChatContext';
import { ChatMessage, ContextScope } from '../types/chat';

const SCOPE_OPTIONS: { value: ContextScope; label: string }[] = [
  { value: 'highlight', label: 'Highlight' },
  { value: 'chapter', label: 'Chapter' },
  { value: 'book', label: 'Whole Book' },
];

export default function ChatPanel() {
  const { isExpanded, conversation, setIsExpanded, addMessage, setScope } = useChat();
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

    // Determine the context based on scope
    let scopeContext: string | undefined;
    if (conversation.scope === 'chapter' && conversation.chapterText) {
      scopeContext = conversation.chapterText;
    } else if (conversation.scope === 'book' && conversation.bookText) {
      scopeContext = conversation.bookText;
    }

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
          scope: conversation.scope,
          scopeContext,
          chapterTitle: conversation.chapterTitle,
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
    <>
    <div
      className="h-full flex flex-col animate-chat-slide-in"
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

      {/* Scope selector pills */}
      <div
        className="px-4 py-3 flex items-center gap-2"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Context:</span>
        <div
          className="flex rounded-lg overflow-hidden"
          style={{ border: '1px solid var(--border)' }}
        >
          {SCOPE_OPTIONS.map((option, index) => {
            const isSelected = conversation.scope === option.value;
            const isDisabled = (option.value === 'chapter' && !conversation.chapterText) ||
                               (option.value === 'book' && !conversation.bookText);
            return (
              <button
                key={option.value}
                onClick={() => !isDisabled && setScope(option.value)}
                disabled={isDisabled}
                className="px-3 py-1.5 text-xs font-medium transition-all"
                style={{
                  background: isSelected ? 'var(--accent)' : 'transparent',
                  color: isSelected ? 'white' : isDisabled ? 'var(--foreground-subtle)' : 'var(--foreground-muted)',
                  borderRight: index < SCOPE_OPTIONS.length - 1 ? '1px solid var(--border)' : 'none',
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  opacity: isDisabled ? 0.5 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!isSelected && !isDisabled) {
                    e.currentTarget.style.background = 'var(--accent-subtle)';
                    e.currentTarget.style.color = 'var(--accent)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected && !isDisabled) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--foreground-muted)';
                  }
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
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
                  h1: ({ children }) => <h1 className="text-xl font-bold mt-4 mb-2">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-lg font-bold mt-3 mb-2">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-base font-semibold mt-3 mb-1">{children}</h3>,
                  ul: ({ children }) => <ul className="list-disc ml-4 my-2">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal ml-4 my-2">{children}</ol>,
                  li: ({ children }) => <li className="mb-1">{children}</li>,
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

    {/* Animation styles */}
    <style jsx global>{`
      @keyframes chatSlideIn {
        from {
          opacity: 0;
          transform: translateX(20px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }
      .animate-chat-slide-in {
        animation: chatSlideIn 250ms ease-out forwards;
      }
    `}</style>
    </>
  );
}
