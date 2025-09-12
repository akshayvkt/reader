'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import ePub from 'epubjs';
import type { Rendition, Contents } from 'epubjs';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Simplifier from './Simplifier';

interface BookReaderProps {
  bookData: ArrayBuffer;
  onClose: () => void;
}

export default function BookReader({ bookData, onClose }: BookReaderProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
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
  }, [rendition]);

  const prevPage = useCallback(() => {
    rendition?.prev();
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
    <div className="fixed inset-0 bg-gray-50 flex flex-col">
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
        
        {/* Larger, more subtle navigation areas */}
        <button
          onClick={prevPage}
          className="absolute left-0 top-0 bottom-0 w-1/5 flex items-center justify-start pl-4 opacity-0 hover:opacity-100 transition-opacity"
          aria-label="Previous page"
        >
          <div className="p-3 rounded-full bg-black/5 hover:bg-black/10">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </div>
        </button>

        <button
          onClick={nextPage}
          className="absolute right-0 top-0 bottom-0 w-1/5 flex items-center justify-end pr-4 opacity-0 hover:opacity-100 transition-opacity"
          aria-label="Next page"
        >
          <div className="p-3 rounded-full bg-black/5 hover:bg-black/10">
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </div>
        </button>
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