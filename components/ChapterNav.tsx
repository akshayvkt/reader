'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { X } from 'lucide-react';
import type { TocItem } from 'epubjs';

interface ChapterNavProps {
  toc: TocItem[];
  currentHref: string;
  onNavigate: (href: string) => void;
  onClose: () => void;
  isOpen: boolean;
  pageNumbers?: Map<string, number>;
}

interface TocRowProps {
  item: TocItem;
  depth: number;
  currentHref: string;
  onNavigate: (href: string) => void;
  pageNumber?: number;
  index: number;
}

function TocRow({ item, depth, currentHref, onNavigate, pageNumber, index }: TocRowProps) {
  // Check if this item is current (href might have fragments, compare base)
  const itemHrefBase = item.href.split('#')[0];
  const currentHrefBase = currentHref.split('#')[0];
  const isCurrent = itemHrefBase === currentHrefBase || item.href === currentHref;

  return (
    <button
      onClick={() => onNavigate(item.href)}
      className="w-full text-left flex items-start justify-between gap-4 transition-all duration-150"
      style={{
        padding: `10px 20px 10px ${20 + depth * 16}px`,
        background: isCurrent ? 'var(--accent-subtle)' : 'transparent',
        borderLeft: isCurrent ? '3px solid var(--accent)' : '3px solid transparent',
        animationDelay: `${index * 25}ms`,
      }}
      onMouseEnter={(e) => {
        if (!isCurrent) {
          e.currentTarget.style.background = 'var(--background-muted)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isCurrent) {
          e.currentTarget.style.background = 'transparent';
        }
      }}
    >
      <span
        className="flex-1 leading-snug"
        style={{
          fontSize: depth === 0 ? '14px' : '13px',
          fontWeight: depth === 0 ? 500 : 400,
          color: isCurrent ? 'var(--accent)' : 'var(--foreground)',
        }}
      >
        {item.label}
      </span>
      {pageNumber !== undefined && (
        <span
          className="flex-shrink-0 tabular-nums"
          style={{
            fontSize: '13px',
            color: 'var(--foreground-muted)',
          }}
        >
          {pageNumber}
        </span>
      )}
    </button>
  );
}

function TocList({
  items,
  depth,
  currentHref,
  onNavigate,
  pageNumbers,
  startIndex,
}: {
  items: TocItem[];
  depth: number;
  currentHref: string;
  onNavigate: (href: string) => void;
  pageNumbers?: Map<string, number>;
  startIndex: number;
}) {
  let currentIndex = startIndex;

  return (
    <>
      {items.map((item) => {
        const itemIndex = currentIndex++;
        const subitemsCount = countItems(item.subitems || []);

        return (
          <div key={item.id || item.href}>
            <TocRow
              item={item}
              depth={depth}
              currentHref={currentHref}
              onNavigate={onNavigate}
              pageNumber={pageNumbers?.get(item.href)}
              index={itemIndex}
            />
            {item.subitems && item.subitems.length > 0 && (
              <TocList
                items={item.subitems}
                depth={depth + 1}
                currentHref={currentHref}
                onNavigate={onNavigate}
                pageNumbers={pageNumbers}
                startIndex={currentIndex}
              />
            )}
            {/* Update index after processing subitems */}
            {(() => {
              currentIndex += subitemsCount;
              return null;
            })()}
          </div>
        );
      })}
    </>
  );
}

function countItems(items: TocItem[]): number {
  return items.reduce((count, item) => {
    return count + 1 + countItems(item.subitems || []);
  }, 0);
}

export default function ChapterNav({
  toc,
  currentHref,
  onNavigate,
  onClose,
  isOpen,
  pageNumbers,
}: ChapterNavProps) {
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [isClosing, setIsClosing] = useState(false);

  // Animated close handler
  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 200);
  }, [onClose]);

  // Handle click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    // Slight delay to prevent immediate close
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }, 100);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
        style={{ background: 'rgba(45, 42, 38, 0.3)' }}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        className={`fixed top-0 left-0 bottom-0 z-50 flex flex-col overflow-hidden ${isClosing ? 'animate-slide-out-left' : 'animate-slide-in-left'}`}
        style={{
          width: '280px',
          background: 'var(--surface)',
          borderRight: '1px solid var(--border)',
          boxShadow: '4px 0 24px rgba(45, 42, 38, 0.15)',
        }}
      >
        {/* Header */}
        <header
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
          <h2
            className="text-xs font-medium uppercase tracking-wider"
            style={{ color: 'var(--foreground-muted)', letterSpacing: '0.5px' }}
          >
            Contents
          </h2>
          <button
            onClick={handleClose}
            className="p-1 rounded transition-colors"
            style={{ color: 'var(--foreground-muted)' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--foreground)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--foreground-muted)'}
            aria-label="Close contents"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* TOC List */}
        <nav className="flex-1 overflow-y-auto py-2">
          {toc.length > 0 ? (
            <TocList
              items={toc}
              depth={0}
              currentHref={currentHref}
              onNavigate={onNavigate}
              pageNumbers={pageNumbers}
              startIndex={0}
            />
          ) : (
            <div
              className="px-5 py-4 text-sm"
              style={{ color: 'var(--foreground-muted)' }}
            >
              No table of contents available
            </div>
          )}
        </nav>
      </aside>

      {/* Animation styles */}
      <style jsx global>{`
        @keyframes slideInLeft {
          from {
            transform: translateX(-100%);
            opacity: 0.8;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes slideOutLeft {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(-100%);
            opacity: 0.8;
          }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        .animate-slide-in-left {
          animation: slideInLeft 200ms ease-out forwards;
        }
        .animate-slide-out-left {
          animation: slideOutLeft 200ms ease-in forwards;
        }
        .animate-fade-in {
          animation: fadeIn 200ms ease-out forwards;
        }
        .animate-fade-out {
          animation: fadeOut 200ms ease-in forwards;
        }
      `}</style>
    </>
  );
}
