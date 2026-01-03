'use client';

import { BookOpen } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

// Simple Google icon
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

export default function LoginScreen() {
  const { login, isLoading } = useAuth();

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: 'var(--background)' }}
    >
      <div className="max-w-sm w-full text-center">
        {/* Logo */}
        <div
          className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-8"
          style={{ background: 'var(--accent-subtle)' }}
        >
          <BookOpen
            className="w-10 h-10"
            style={{ color: 'var(--accent)' }}
            strokeWidth={1.5}
          />
        </div>

        {/* Title */}
        <h1
          className="text-3xl mb-3"
          style={{
            fontFamily: 'var(--font-libre-baskerville)',
            color: 'var(--foreground)',
          }}
        >
          Simple Reader
        </h1>

        {/* Subtitle */}
        <p
          className="text-base mb-10"
          style={{ color: 'var(--foreground-muted)' }}
        >
          Read deeply. Understand fully.
        </p>

        {/* Sign in button */}
        <button
          onClick={login}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl text-base font-medium transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: 'var(--surface)',
            color: 'var(--foreground)',
            border: '1px solid var(--border)',
            boxShadow: '0 2px 8px rgba(45, 42, 38, 0.08)',
          }}
        >
          <GoogleIcon />
          {isLoading ? 'Loading...' : 'Continue with Google'}
        </button>

        {/* Privacy note */}
        <p
          className="mt-6 text-xs"
          style={{ color: 'var(--foreground-subtle)' }}
        >
          Your books stay on your device. We only use your email to identify you.
        </p>
      </div>
    </div>
  );
}
