'use client';

import { ReactNode, useEffect, useState, useCallback, useRef } from 'react';
import { MessageSquare } from 'lucide-react';
import { useChat } from '../contexts/ChatContext';
import ChatPanel from './ChatPanel';

interface ReaderLayoutProps {
  children: ReactNode;
  onResize?: () => void;
}

const MIN_CHAT_WIDTH = 25; // minimum 25%
const MAX_CHAT_WIDTH = 45; // maximum 45%
const DEFAULT_CHAT_WIDTH = 40; // default 40%

export default function ReaderLayout({ children, onResize }: ReaderLayoutProps) {
  const { isExpanded, conversation, setIsExpanded } = useChat();
  const [chatWidth, setChatWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('reader-chat-width');
      return saved ? parseFloat(saved) : DEFAULT_CHAT_WIDTH;
    }
    return DEFAULT_CHAT_WIDTH;
  });
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle drag to resize
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const mouseX = e.clientX - containerRect.left;

    // Calculate chat width as percentage (from right side)
    const newChatWidth = ((containerWidth - mouseX) / containerWidth) * 100;

    // Clamp to min/max
    const clampedWidth = Math.min(MAX_CHAT_WIDTH, Math.max(MIN_CHAT_WIDTH, newChatWidth));
    setChatWidth(clampedWidth);
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      // Save to localStorage
      localStorage.setItem('reader-chat-width', chatWidth.toString());
      // Trigger resize for epub
      if (onResize) {
        onResize();
      }
    }
  }, [isDragging, chatWidth, onResize]);

  // Add/remove global mouse listeners for dragging
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      // Prevent text selection while dragging
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Notify parent when layout changes (for epub/pdf resize)
  useEffect(() => {
    if (onResize) {
      // Small delay to allow transition to complete
      const timeout = setTimeout(onResize, 350);
      return () => clearTimeout(timeout);
    }
  }, [isExpanded, onResize]);

  const readerWidth = isExpanded ? `${100 - chatWidth}%` : '100%';
  const panelWidth = isExpanded ? `${chatWidth}%` : '0';

  return (
    <div ref={containerRef} className="fixed inset-0 flex">
      {/* Reader container */}
      <div
        className={`h-full relative ${isDragging ? '' : 'transition-all duration-300 ease-in-out'}`}
        style={{ width: readerWidth }}
      >
        {children}

        {/* Minimized chat tab - shows when chat is closed but conversation exists */}
        {!isExpanded && conversation && (
          <button
            onClick={() => setIsExpanded(true)}
            className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-2 py-3 px-2 rounded-l-lg transition-all hover:px-3"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRight: 'none',
              boxShadow: '-2px 0 8px rgba(0, 0, 0, 0.1)',
              color: 'var(--foreground-muted)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--accent)';
              e.currentTarget.style.background = 'var(--accent-subtle)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--foreground-muted)';
              e.currentTarget.style.background = 'var(--surface)';
            }}
            title="Reopen chat"
          >
            <MessageSquare className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Draggable divider */}
      {isExpanded && (
        <div
          onMouseDown={handleMouseDown}
          className="w-1 h-full cursor-col-resize hover:bg-[var(--accent)] transition-colors relative group"
          style={{ background: isDragging ? 'var(--accent)' : 'var(--border)' }}
        >
          {/* Wider invisible hit area */}
          <div className="absolute inset-y-0 -left-1 -right-1" />
        </div>
      )}

      {/* Chat panel */}
      <div
        className={`h-full overflow-hidden ${isDragging ? '' : 'transition-all duration-300 ease-in-out'}`}
        style={{ width: panelWidth }}
      >
        <ChatPanel />
      </div>
    </div>
  );
}
