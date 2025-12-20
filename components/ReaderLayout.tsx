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
  const chatWidthRef = useRef(chatWidth);

  // Keep ref in sync with state
  useEffect(() => {
    chatWidthRef.current = chatWidth;
  }, [chatWidth]);

  // Handle drag to resize using pointer events with capture
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    console.log('[Divider] pointerdown fired');
    e.preventDefault();

    // Capture pointer - this ensures we get all pointer events even over iframes
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsDragging(true);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const mouseX = e.clientX - containerRect.left;

    // Calculate chat width as percentage (from right side)
    const newChatWidth = ((containerWidth - mouseX) / containerWidth) * 100;

    // Clamp to min/max
    const clampedWidth = Math.min(MAX_CHAT_WIDTH, Math.max(MIN_CHAT_WIDTH, newChatWidth));
    console.log('[Divider] pointermove - newWidth:', clampedWidth.toFixed(1) + '%');
    setChatWidth(clampedWidth);
    chatWidthRef.current = clampedWidth;
  }, [isDragging]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    console.log('[Divider] pointerup fired');

    // Release pointer capture
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    setIsDragging(false);

    // Save to localStorage
    localStorage.setItem('reader-chat-width', chatWidthRef.current.toString());

    // Trigger resize for epub
    if (onResize) {
      onResize();
    }

    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }, [onResize]);

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

      {/* Draggable divider - minimal, subtle line */}
      {isExpanded && (
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="w-1 h-full cursor-col-resize touch-none transition-opacity duration-200 hover:opacity-100"
          style={{
            background: 'var(--border)',
            opacity: isDragging ? 1 : 0.3
          }}
        />
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
