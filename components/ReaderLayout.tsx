'use client';

import { ReactNode, useEffect } from 'react';
import { MessageSquare } from 'lucide-react';
import { useChat } from '../contexts/ChatContext';
import ChatPanel from './ChatPanel';

interface ReaderLayoutProps {
  children: ReactNode;
  onResize?: () => void;
}

export default function ReaderLayout({ children, onResize }: ReaderLayoutProps) {
  const { isExpanded, conversation, setIsExpanded } = useChat();

  // Notify parent when layout changes (for epub/pdf resize)
  useEffect(() => {
    if (onResize) {
      // Small delay to allow transition to complete
      const timeout = setTimeout(onResize, 350);
      return () => clearTimeout(timeout);
    }
  }, [isExpanded, onResize]);

  return (
    <div className="fixed inset-0 flex">
      {/* Reader container */}
      <div
        className="transition-all duration-300 ease-in-out h-full relative"
        style={{ width: isExpanded ? '60%' : '100%' }}
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

      {/* Chat panel */}
      <div
        className="transition-all duration-300 ease-in-out h-full overflow-hidden"
        style={{ width: isExpanded ? '40%' : '0' }}
      >
        <ChatPanel />
      </div>
    </div>
  );
}
