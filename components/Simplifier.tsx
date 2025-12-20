'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, Lightbulb, Sparkles, Send, Maximize2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage } from '../types/chat';

interface SimplifierProps {
  text: string;
  position: { x: number; y: number };
  onClose: () => void;
  onExpand?: (originalText: string, messages: ChatMessage[]) => void;
  bookContext?: string;
}

export default function Simplifier({ text, position, onClose, onExpand }: SimplifierProps) {
  const [simplified, setSimplified] = useState('');
  const [loading, setLoading] = useState(false);
  const [followUpInput, setFollowUpInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sendingFollowUp, setSendingFollowUp] = useState(false);
  const [popupStyle, setPopupStyle] = useState<{ left: string; top: string }>({ left: '0px', top: '0px' });
  const popupRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    // Use a slight delay to avoid closing immediately on text selection
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }, 100);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Smart positioning - position ABOVE selection (like Kindle/Apple Books)
  useEffect(() => {
    if (!popupRef.current) return;

    const popup = popupRef.current;
    const rect = popup.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    // Center horizontally on the selection
    let x = position.x - rect.width / 2;

    // Position ABOVE the selection by default (better UX - doesn't cover text)
    let y = position.y - rect.height - 8;

    // If would go off top of screen, show below selection instead
    if (y < 20) {
      y = position.y + 8;
    }

    // If would still go off bottom, just pin to bottom
    if (y + rect.height > viewportHeight - 20) {
      y = viewportHeight - rect.height - 20;
    }

    // If would go off right edge, shift left
    if (x + rect.width > viewportWidth - 20) {
      x = viewportWidth - rect.width - 20;
    }

    // Never go off left edge
    x = Math.max(20, x);

    setPopupStyle({ left: `${x}px`, top: `${y}px` });
  }, [position, simplified, loading]); // Recalculate when content changes

  const fetchDictionaryDefinition = async (word: string) => {
    try {
      const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`);
      if (!response.ok) throw new Error('Word not found');
      
      const data = await response.json();
      const meanings = data[0]?.meanings || [];
      
      // Format the definition nicely
      const definitions = meanings.slice(0, 2).map((m: { partOfSpeech: string; definitions: Array<{ definition: string }> }) => 
        `${m.partOfSpeech}: ${m.definitions[0]?.definition}`
      ).join('; ');
      
      return definitions || 'No definition found';
    } catch {
      // Fall back to AI if dictionary fails
      return null;
    }
  };

  const simplifyText = useCallback(async (mode: 'explain' | 'eli5' = 'explain') => {
    setLoading(true);

    // For single words with "explain" mode, try dictionary first
    if (mode === 'explain' && text.split(' ').length === 1) {
      const dictDefinition = await fetchDictionaryDefinition(text);
      if (dictDefinition) {
        setSimplified(dictDefinition);
        setLoading(false);
        return;
      }
    }

    // Use AI for phrases or if dictionary fails
    try {
      const response = await fetch('/api/simplify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, mode }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error:', response.status, errorText);
        setSimplified('Failed to simplify text. Please try again.');
        return;
      }

      const data = await response.json();
      const responseText = data.simplified || 'Unable to simplify text';
      setSimplified(responseText);

      // Store as first message in conversation
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: responseText,
        timestamp: Date.now(),
      };
      setMessages([assistantMessage]);
    } catch (error) {
      console.error('Failed to simplify text:', error);
      setSimplified('Failed to simplify text. Please try again.');
    }
    setLoading(false);
  }, [text]);

  const sendFollowUp = useCallback(async () => {
    if (!followUpInput.trim() || sendingFollowUp) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: followUpInput.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setFollowUpInput('');
    setSendingFollowUp(true);

    try {
      const response = await fetch('/api/simplify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: userMessage.content,
          mode: 'followup',
          originalText: text,
          conversationHistory: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.simplified || 'Unable to respond',
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Failed to send follow-up:', error);
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Failed to get response. Please try again.',
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);
    }
    setSendingFollowUp(false);
  }, [followUpInput, sendingFollowUp, text, messages]);

  const handleExpandToChat = useCallback(() => {
    if (onExpand && messages.length > 0) {
      onExpand(text, messages);
      onClose();
    }
  }, [onExpand, text, messages, onClose]);


  return (
    <>
      {/* Invisible backdrop for click-to-close */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={popupRef}
        className="fixed z-50 backdrop-blur-sm rounded-xl py-2 animate-popup-in"
        style={{
          ...popupStyle,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: '0 12px 40px rgba(45, 35, 25, 0.18), 0 4px 12px rgba(45, 35, 25, 0.08)'
        }}
      >
      {/* Expand button - top right corner */}
      {onExpand && simplified && !loading && (
        <button
          onClick={handleExpandToChat}
          className="absolute top-2 right-2 p-1.5 rounded-md transition-colors"
          style={{ color: 'var(--foreground-subtle)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--accent)';
            e.currentTarget.style.background = 'var(--accent-subtle)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--foreground-subtle)';
            e.currentTarget.style.background = 'transparent';
          }}
          title="Expand"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      )}

      {!simplified && !loading ? (
        <>
          <button
            onClick={() => simplifyText('explain')}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors duration-150 text-left whitespace-nowrap group"
            style={{ color: 'var(--foreground)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--accent-subtle)';
              e.currentTarget.style.color = 'var(--accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--foreground)';
            }}
          >
            <Lightbulb className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            <span>Explain</span>
          </button>
          <button
            onClick={() => simplifyText('eli5')}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors duration-150 text-left whitespace-nowrap group"
            style={{ color: 'var(--foreground)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--accent-subtle)';
              e.currentTarget.style.color = 'var(--accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--foreground)';
            }}
          >
            <Sparkles className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            <span>ELI5</span>
          </button>
        </>
      ) : loading ? (
        <div className="flex items-center gap-2.5 px-4 py-2.5 min-w-[140px]">
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--accent)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>Loading...</span>
        </div>
      ) : (
        <div className="max-w-md">
          {/* Messages */}
          <div className="text-sm leading-relaxed overflow-y-auto max-h-[300px] px-4 py-2" style={{ color: 'var(--foreground)' }}>
            {messages.map((msg, index) => (
              <div
                key={msg.id}
                className={index > 0 ? 'mt-3' : ''}
                style={index === 0 ? { borderLeft: '2px solid var(--accent)', paddingLeft: '12px' } : {}}
              >
                {/* Only show labels for follow-up messages (index > 0) */}
                {index > 0 && (
                  <div className="text-xs font-medium mb-1" style={{ color: msg.role === 'user' ? 'var(--foreground-muted)' : 'var(--accent)' }}>
                    {msg.role === 'user' ? 'You:' : 'Reader:'}
                  </div>
                )}
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
            ))}
            {sendingFollowUp && (
              <div className="mt-3 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--accent)' }} />
                <span style={{ color: 'var(--foreground-muted)' }}>Thinking...</span>
              </div>
            )}
          </div>

          {/* Follow-up input */}
          <div className="px-4 py-3">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={followUpInput}
                onChange={(e) => setFollowUpInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendFollowUp();
                  }
                }}
                placeholder="Ask a follow-up..."
                className="flex-1 px-3 py-1.5 text-sm rounded-lg outline-none transition-colors"
                style={{
                  background: 'var(--background)',
                  color: 'var(--foreground)',
                  border: '1px solid var(--border)',
                }}
                disabled={sendingFollowUp}
              />
              <button
                onClick={sendFollowUp}
                disabled={!followUpInput.trim() || sendingFollowUp}
                className="p-1.5 rounded-lg transition-colors disabled:opacity-50"
                style={{ background: 'var(--accent)', color: 'white' }}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

      {/* Animation styles */}
      <style jsx global>{`
        @keyframes popupIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(4px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .animate-popup-in {
          animation: popupIn 150ms ease-out forwards;
        }
      `}</style>
    </>
  );
}