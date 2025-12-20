'use client';

import { RecentBook } from '../types/library';
import BookCover from './BookCover';

interface RecentBookCardProps {
  book: RecentBook;
  onClick: () => void;
  index: number;
}

export default function RecentBookCard({ book, onClick, index }: RecentBookCardProps) {
  return (
    <button
      onClick={onClick}
      className="text-left transition-all duration-200 hover:scale-105 group animate-fade-in"
      style={{
        animationDelay: `${index * 50}ms`,
        animationFillMode: 'backwards',
      }}
    >
      {/* Cover */}
      <div
        className="rounded-lg overflow-hidden mb-3 transition-shadow duration-200"
        style={{
          boxShadow: '0 2px 8px rgba(45, 42, 38, 0.1)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(45, 42, 38, 0.15)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(45, 42, 38, 0.1)';
        }}
      >
        <BookCover
          coverUrl={book.coverUrl}
          title={book.title}
          size="small"
        />
      </div>

      {/* Title */}
      <p
        className="text-sm leading-snug line-clamp-2"
        style={{
          color: 'var(--foreground)',
          fontFamily: 'var(--font-libre-baskerville)',
          maxWidth: '144px',
        }}
      >
        {book.title}
      </p>

      {/* Progress indicator */}
      {book.progress > 0 && (
        <div
          className="mt-1.5 h-0.5 rounded-full overflow-hidden"
          style={{ background: 'var(--border)', width: '144px' }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${book.progress}%`,
              background: 'var(--accent)',
            }}
          />
        </div>
      )}
    </button>
  );
}
