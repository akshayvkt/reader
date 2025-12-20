'use client';

import { ArrowRight } from 'lucide-react';
import { RecentBook } from '../types/library';
import BookCover from './BookCover';

interface HeroBookCardProps {
  book: RecentBook;
  onClick: () => void;
}

export default function HeroBookCard({ book, onClick }: HeroBookCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl p-8 transition-all duration-300 hover:scale-[1.01] group animate-fade-in-up"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-subtle)',
        boxShadow: '0 4px 24px rgba(45, 42, 38, 0.08)',
      }}
    >
      <div className="flex gap-8 items-start">
        {/* Cover */}
        <div
          className="flex-shrink-0 rounded-lg overflow-hidden transition-transform duration-300 group-hover:scale-105"
          style={{
            width: '140px',
            boxShadow: '0 8px 24px rgba(45, 42, 38, 0.15)',
          }}
        >
          <BookCover
            coverUrl={book.coverUrl}
            title={book.title}
            size="large"
          />
        </div>

        {/* Info */}
        <div className="flex-1 py-2">
          <p
            className="text-xs font-medium uppercase tracking-wider mb-3"
            style={{ color: 'var(--accent)' }}
          >
            Continue Reading
          </p>

          <h2
            className="text-2xl mb-2 leading-tight"
            style={{
              fontFamily: 'var(--font-libre-baskerville)',
              color: 'var(--foreground)',
            }}
          >
            {book.title}
          </h2>

          <p
            className="text-sm mb-6"
            style={{ color: 'var(--foreground-muted)' }}
          >
            {book.author}
          </p>

          {/* Progress bar */}
          <div className="mb-6">
            <div className="flex justify-between text-xs mb-1.5">
              <span style={{ color: 'var(--foreground-muted)' }}>Progress</span>
              <span style={{ color: 'var(--foreground-muted)' }}>{book.progress}%</span>
            </div>
            <div
              className="h-1 rounded-full overflow-hidden"
              style={{ background: 'var(--border)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${book.progress}%`,
                  background: 'var(--accent)',
                }}
              />
            </div>
          </div>

          {/* CTA */}
          <div
            className="inline-flex items-center gap-2 text-sm font-medium transition-all duration-200 group-hover:gap-3"
            style={{ color: 'var(--accent)' }}
          >
            <span>Resume</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      </div>
    </button>
  );
}
