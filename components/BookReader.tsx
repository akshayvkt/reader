'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import ePub from 'epubjs';
import type { Rendition, Contents } from 'epubjs';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Simplifier from './Simplifier';

export interface BookReaderProps {
  bookData: ArrayBuffer;
  onClose: () => void;
}

export default function BookReader({ bookData, onClose }: BookReaderProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [rendition, setRendition] = useState<Rendition | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [selectionPosition, setSelectionPosition] = useState({ x: 0, y: 0 });
  const [showSimplifier, setShowSimplifier] = useState(false);

  useEffect(() => {
    if (!viewerRef.current || !bookData) return;

    // Create book from ArrayBuffer with 'binary' option
    const book = new ePub(bookData, { openAs: 'binary' });
    const rend = book.renderTo(viewerRef.current, {
      width: '100%',
      height: '100%',
      flow: 'paginated',
    });

    rend.display().then(() => {
      console.log('Book displayed successfully');
      setRendition(rend);
      // Focus the container to ensure keyboard events work
      containerRef.current?.focus();
    }).catch((error: any) => {
      console.error('Error displaying book:', error);
    });

    const handleSelection = (e: MouseEvent) => {
      const contents = rend.getContents();
      contents.forEach((content: Contents) => {
        const selection = content.window.getSelection();
        if (selection && selection.toString().trim()) {
          const text = selection.toString();
          setSelectedText(text);
          setSelectionPosition({ x: e.clientX, y: e.clientY });
          setShowSimplifier(true);
        }
      });
    };

    rend.on('selected', handleSelection);

    // Use a hash of the book data for localStorage key
    const bookId = bookData.byteLength.toString();
    const savedLocation = localStorage.getItem(`book-location-${bookId}`);
    if (savedLocation) {
      rend.display(savedLocation);
    }

    rend.on('relocated', (location: any) => {
      localStorage.setItem(`book-location-${bookId}`, location.start.cfi);
    });

    return () => {
      rend.destroy();
    };
  }, [bookData]);

  const nextPage = useCallback(() => {
    rendition?.next();
    // Refocus container to maintain keyboard navigation
    containerRef.current?.focus();
  }, [rendition]);

  const prevPage = useCallback(() => {
    rendition?.prev();
    // Refocus container to maintain keyboard navigation
    containerRef.current?.focus();
  }, [rendition]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') nextPage();
    if (e.key === 'ArrowLeft') prevPage();
    if (e.key === 'Escape') setShowSimplifier(false);
  }, [nextPage, prevPage]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 bg-gray-50 flex flex-col outline-none"
      tabIndex={0}
    >
      {/* Minimal header - auto-hides */}
      <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-white/90 to-transparent transition-opacity hover:opacity-100 opacity-0">
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 bg-white/80 backdrop-blur rounded-lg"
        >
          ← Back to Library
        </button>
      </header>

      <div className="flex-1 relative">
        <div ref={viewerRef} className="w-full h-full" />
        
        {/* Visible navigation buttons at bottom */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4 z-10">
          <button
            onClick={prevPage}
            className="p-2 rounded-full bg-white/90 hover:bg-white shadow-lg transition-all"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-5 h-5 text-gray-700" />
          </button>

          <button
            onClick={nextPage}
            className="p-2 rounded-full bg-white/90 hover:bg-white shadow-lg transition-all"
            aria-label="Next page"
          >
            <ChevronRight className="w-5 h-5 text-gray-700" />
          </button>
        </div>
      </div>

      {showSimplifier && (
        <Simplifier
          text={selectedText}
          position={selectionPosition}
          onClose={() => setShowSimplifier(false)}
        />
      )}
    </div>
  );
}