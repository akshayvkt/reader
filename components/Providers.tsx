'use client';

import { ReactNode } from 'react';
import { ChatProvider } from '../contexts/ChatContext';

interface ProvidersProps {
  children: ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <ChatProvider>
      {children}
    </ChatProvider>
  );
}
