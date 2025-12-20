'use client';

import { ReactNode, useEffect } from 'react';
import { useChat } from '../contexts/ChatContext';
import ChatPanel from './ChatPanel';

interface ReaderLayoutProps {
  children: ReactNode;
  onResize?: () => void;
}

export default function ReaderLayout({ children, onResize }: ReaderLayoutProps) {
  const { isExpanded } = useChat();

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
        className="transition-all duration-300 ease-in-out h-full"
        style={{ width: isExpanded ? '60%' : '100%' }}
      >
        {children}
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
