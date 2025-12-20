'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { BookOpen, Plus } from 'lucide-react';
import BookReaderWrapper from '@/components/BookReaderWrapper';
import HeroBookCard from '@/components/HeroBookCard';
import RecentBookCard from '@/components/RecentBookCard';
import { getRecentBooks } from '@/lib/libraryStorage';
import { RecentBook } from '@/types/library';

export default function Home() {
  const [bookData, setBookData] = useState<ArrayBuffer | null>(null);
  const [currentFilePath, setCurrentFilePath] = useState<string | undefined>(undefined);
  const [isDragging, setIsDragging] = useState(false);
  const [recentBooks, setRecentBooks] = useState<RecentBook[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load recent books on mount
  useEffect(() => {
    setRecentBooks(getRecentBooks());
  }, []);

  // Refresh recent books when returning from reader
  useEffect(() => {
    if (!bookData) {
      setRecentBooks(getRecentBooks());
    }
  }, [bookData]);

  const handleFileUpload = useCallback(async (file: File) => {
    const isEpub = file.type === 'application/epub+zip' || file.name.endsWith('.epub');
    const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');

    if (!isEpub && !isPdf) {
      alert('Please upload an EPUB or PDF file');
      return;
    }

    // Get the file data
    const arrayBuffer = await file.arrayBuffer();

    // In Electron, copy the book to our library folder
    let libraryPath: string | undefined;
    if (file.path && window.electronAPI) {
      try {
        // Import book to library (copies the file)
        libraryPath = await window.electronAPI.importBook(file.path);
      } catch (error) {
        console.error('Error importing book to library:', error);
        // Fall back to original path if import fails
        libraryPath = file.path;
      }
    }

    setCurrentFilePath(libraryPath);
    setLoadError(null);
    setBookData(arrayBuffer);
  }, []);

  // Open a book from the recent books list
  const openBook = useCallback(async (book: RecentBook) => {
    // If we have a file path and we're in Electron, read the file directly
    if (book.filePath && window.electronAPI) {
      try {
        // Check if file still exists
        const exists = await window.electronAPI.fileExists(book.filePath);
        if (!exists) {
          setLoadError(`File not found: "${book.title}" may have been moved or deleted. Please add it again.`);
          return;
        }

        const arrayBuffer = await window.electronAPI.readFile(book.filePath);
        setCurrentFilePath(book.filePath);
        setLoadError(null);
        setBookData(arrayBuffer);
      } catch (error) {
        console.error('Error reading file:', error);
        setLoadError(`Could not open "${book.title}". The file may have been moved or deleted.`);
      }
    } else {
      // Fallback for browser or books without filePath: open file picker
      openFilePicker();
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  if (bookData) {
    return (
      <BookReaderWrapper
        bookData={bookData}
        filePath={currentFilePath}
        onClose={() => {
          setBookData(null);
          setCurrentFilePath(undefined);
        }}
      />
    );
  }

  const hasRecentBooks = recentBooks.length > 0;
  const currentBook = recentBooks[0];
  const otherBooks = recentBooks.slice(1);

  return (
    <div
      className="min-h-screen"
      style={{ background: 'var(--background)' }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".epub,application/epub+zip,.pdf,application/pdf"
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Header */}
        <header className="flex items-center justify-between mb-12">
          <h1
            className="text-xs font-medium uppercase tracking-wider"
            style={{
              fontFamily: 'var(--font-libre-baskerville)',
              color: 'var(--foreground-muted)',
              letterSpacing: '0.1em',
            }}
          >
            Reader
          </h1>

          <button
            onClick={openFilePicker}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 hover:scale-105"
            style={{
              background: 'var(--surface)',
              color: 'var(--foreground-muted)',
              border: '1px solid var(--border-subtle)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--foreground)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(45, 42, 38, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--foreground-muted)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <Plus className="w-4 h-4" />
            Add Book
          </button>
        </header>

        {/* Error message when file can't be loaded */}
        {loadError && (
          <div
            className="mb-6 p-4 rounded-lg"
            style={{
              background: 'var(--accent-subtle)',
              border: '1px solid var(--accent)',
              color: 'var(--foreground)',
            }}
          >
            <p className="text-sm">{loadError}</p>
            <button
              onClick={() => setLoadError(null)}
              className="mt-2 text-xs font-medium"
              style={{ color: 'var(--accent)' }}
            >
              Dismiss
            </button>
          </div>
        )}

        {hasRecentBooks ? (
          <>
            {/* Hero: Continue Reading */}
            <section className="mb-12">
              <HeroBookCard
                book={currentBook}
                onClick={() => openBook(currentBook)}
              />
            </section>

            {/* Other Recent Books */}
            {otherBooks.length > 0 && (
              <section>
                <h2
                  className="text-xs font-medium uppercase tracking-wider mb-6"
                  style={{
                    color: 'var(--foreground-muted)',
                    letterSpacing: '0.1em',
                  }}
                >
                  Recent
                </h2>

                <div className="flex gap-6 flex-wrap">
                  {otherBooks.map((book, index) => (
                    <RecentBookCard
                      key={book.id}
                      book={book}
                      onClick={() => openBook(book)}
                      index={index}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        ) : (
          /* Empty State - Original Drop Zone */
          <div
            className={`
              relative rounded-3xl p-20 text-center
              transition-all duration-300 ease-out cursor-pointer
              ${isDragging ? 'scale-[1.02]' : 'hover:scale-[1.01]'}
            `}
            style={{
              background: 'var(--surface)',
              boxShadow: isDragging
                ? '0 20px 40px rgba(45, 42, 38, 0.15)'
                : '0 4px 20px rgba(45, 42, 38, 0.08)',
              border: '1px solid var(--border-subtle)',
            }}
            onClick={openFilePicker}
          >
            <div className="flex flex-col items-center gap-6">
              <BookOpen
                className={`w-12 h-12 transition-all duration-300 ${isDragging ? 'scale-110' : ''}`}
                style={{ color: isDragging ? 'var(--accent)' : 'var(--foreground-subtle)' }}
              />

              <div className="text-center">
                <p
                  className="text-xl mb-1"
                  style={{ fontFamily: 'var(--font-libre-baskerville)', color: 'var(--foreground)' }}
                >
                  Add your book
                </p>
                <p
                  className="text-sm"
                  style={{ color: 'var(--foreground-subtle)' }}
                >
                  EPUB or PDF files
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Drag overlay when dragging over the page */}
        {isDragging && hasRecentBooks && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
            style={{ background: 'rgba(250, 247, 242, 0.95)' }}
          >
            <div className="text-center animate-fade-in">
              <BookOpen
                className="w-16 h-16 mx-auto mb-4"
                style={{ color: 'var(--accent)' }}
              />
              <p
                className="text-xl"
                style={{ fontFamily: 'var(--font-libre-baskerville)', color: 'var(--foreground)' }}
              >
                Drop to open
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Global animations */}
      <style jsx global>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .animate-fade-in-up {
          animation: fadeInUp 0.4s ease-out forwards;
        }

        .animate-fade-in {
          animation: fadeIn 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
