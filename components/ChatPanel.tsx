'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, ArrowUp, Loader2 } from 'lucide-react';
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
  const userMessageRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const shouldScrollToUserMessage = useRef<boolean>(false);
  const [dynamicPadding, setDynamicPadding] = useState<number>(0);

  // Scroll to user message when flag is set
  useEffect(() => {
    if (shouldScrollToUserMessage.current && userMessageRef.current && messagesContainerRef.current) {
      shouldScrollToUserMessage.current = false;

      // Wait for next frame to ensure DOM is fully updated
      requestAnimationFrame(() => {
        const container = messagesContainerRef.current;
        const message = userMessageRef.current;
        if (container && message) {
          // Use getBoundingClientRect for accurate positioning
          const containerRect = container.getBoundingClientRect();
          const messageRect = message.getBoundingClientRect();

          // Distance from message to top of visible container area
          const distanceFromTop = messageRect.top - containerRect.top;

          // Add to current scroll to get target position
          const scrollTarget = container.scrollTop + distanceFromTop;

          console.log('=== Scroll Debug ===');
          console.log('Distance from top:', distanceFromTop);
          console.log('Current scrollTop:', container.scrollTop);
          console.log('Scroll target:', scrollTarget);

          container.scrollTo({ top: scrollTarget, behavior: 'smooth' });

          setTimeout(() => {
            console.log('ScrollTop after:', container.scrollTop);
          }, 500);
        }
      });
    }
  }, [conversation?.messages]);

  // Calculate dynamic padding after AI responds - no scrolling, just update padding
  useEffect(() => {
    // Only run when not sending and we have messages
    if (sending || !conversation?.messages?.length) return;

    // Only recalculate when last message is from AI (just received response)
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    if (lastMessage.role !== 'assistant') return;

    // Wait for DOM to be fully updated
    const timer = setTimeout(() => {
      const container = messagesContainerRef.current;
      const userMessage = userMessageRef.current;
      if (!container || !userMessage) return;

      const containerHeight = container.clientHeight;
      const userMsgHeight = userMessage.offsetHeight;

      // Get the next sibling (AI response) if it exists
      const aiResponse = userMessage.nextElementSibling as HTMLElement | null;
      const aiResponseHeight = aiResponse?.offsetHeight || 0;

      // Total content height from user message through AI response + spacing
      const contentHeight = userMsgHeight + aiResponseHeight + 32;
      const neededPadding = Math.max(0, containerHeight - contentHeight);

      // Just update padding - scroll position stays exactly where it is
      setDynamicPadding(neededPadding);
    }, 50);

    return () => clearTimeout(timer);
  }, [sending, conversation?.messages]);

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

    // Flag to scroll to this user message after it renders
    shouldScrollToUserMessage.current = true;

    // Set large padding immediately to allow scrolling user message to top
    setDynamicPadding(window.innerHeight);

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

      {/* Scope selector pills */}
      <div
        className="px-4 py-3 flex items-center gap-2"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <span className="text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>Context:</span>
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

      {/* Messages - dynamic bottom padding to allow scrolling user message to top */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ paddingBottom: dynamicPadding > 0 ? `${dynamicPadding}px` : undefined }}>
        {/* Selected text with terracotta accent */}
        <div
          className="text-sm italic"
          style={{
            borderLeft: '2px solid var(--accent)',
            paddingLeft: '12px',
            color: 'var(--foreground-muted)',
          }}
        >
          &ldquo;{conversation.originalText}&rdquo;
        </div>

        {conversation.messages.map((msg, index) => {
          // Attach ref to the last user message
          const isLastUserMessage = msg.role === 'user' &&
            !conversation.messages.slice(index + 1).some(m => m.role === 'user');
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              ref={isLastUserMessage ? userMessageRef : null}
              className={isUser ? 'flex justify-end' : ''}
            >
              <div
                className={`text-sm leading-relaxed ${isUser ? 'px-4 py-3 rounded-2xl max-w-[95%]' : ''}`}
                style={{
                  color: 'var(--foreground)',
                  background: isUser ? 'var(--background-muted)' : 'transparent',
                }}
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
                    hr: () => <hr className="my-4 border-t" style={{ borderColor: 'var(--border)' }} />,
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              </div>
            </div>
          );
        })}
        {sending && (
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--accent)' }} />
            <span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Thinking...</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-4 py-3">
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
            <ArrowUp className="w-4 h-4" />
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
