'use client';

import { ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';
import LoginScreen from './LoginScreen';

interface AuthGateProps {
  children: ReactNode;
}

export default function AuthGate({ children }: AuthGateProps) {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--background)' }}
      >
        <div
          className="w-8 h-8 border-2 rounded-full animate-spin"
          style={{
            borderColor: 'var(--border)',
            borderTopColor: 'var(--accent)',
          }}
        />
      </div>
    );
  }

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  // User is authenticated, show the app
  return <>{children}</>;
}
