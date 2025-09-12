'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import ePub from 'epubjs';
import type { Rendition, Contents } from 'epubjs';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Simplifier from './Simplifier';

interface BookReaderProps {
  url: string;
  onClose: () => void;
}

export default function BookReader({ url, onClose }: BookReaderProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [rendition, setRendition] = useState<Rendition | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [selectionPosition, setSelectionPosition] = useState({ x: 0, y: 0 });
  const [showSimplifier, setShowSimplifier] = useState(false);

  useEffect(() => {
    if (!viewerRef.current) return;

    const book = new ePub(url);
    const rendition = book.renderTo(viewerRef.current, {
      width: '100%',
      height: '100%',
      flow: 'paginated',
    });

    rendition.display();
    setRendition(rendition);

    const handleSelection = (e: MouseEvent) => {
      const contents = rendition.getContents();
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

    rendition.on('selected', handleSelection);

    const savedLocation = localStorage.getItem(`book-location-${url}`);
    if (savedLocation) {
      rendition.display(savedLocation);
    }

    rendition.on('relocated', (location: any) => {
      localStorage.setItem(`book-location-${url}`, location.start.cfi);
    });

    return () => {
      rendition.destroy();
    };
  }, [url]);

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
    <div className="fixed inset-0 bg-white flex flex-col">
      <header className="flex items-center justify-between p-4 border-b">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          Close
        </button>
      </header>

      <div className="flex-1 relative">
        <div ref={viewerRef} className="w-full h-full" />
        
        <button
          onClick={prevPage}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 hover:bg-white shadow-lg"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <button
          onClick={nextPage}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 hover:bg-white shadow-lg"
          aria-label="Next page"
        >
          <ChevronRight className="w-6 h-6" />
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