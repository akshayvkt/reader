'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import ePub from 'epubjs';
import type { Rendition, Contents } from 'epubjs';
import { ChevronLeft, ChevronRight, Type, AlignJustify, AArrowUp } from 'lucide-react';
import Simplifier from './Simplifier';

export interface BookReaderProps {
  bookData: ArrayBuffer;
  onClose: () => void;
}

const FONT_OPTIONS = [
  { name: 'Arial', value: 'Arial, sans-serif' },
  { name: 'System Default', value: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' },
  { name: 'Georgia', value: 'Georgia, serif' },
  { name: 'Merriweather', value: '"Merriweather", Georgia, serif' },
  { name: 'Open Dyslexic', value: '"OpenDyslexic", Arial, sans-serif' },
  { name: 'Times New Roman', value: '"Times New Roman", Times, serif' },
];

const LINE_SPACING_OPTIONS = [
  { name: 'Compact', value: '1.4' },
  { name: 'Normal', value: '1.6' },
  { name: 'Relaxed', value: '1.8' },
  { name: 'Loose', value: '2.0' },
];

const FONT_SIZE_OPTIONS = [
  { name: 'Small', value: '14px' },
  { name: 'Medium', value: '16px' },
  { name: 'Large', value: '18px' },
  { name: 'Extra Large', value: '20px' },
];

export default function BookReader({ bookData, onClose }: BookReaderProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [rendition, setRendition] = useState<Rendition | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [selectionPosition, setSelectionPosition] = useState({ x: 0, y: 0 });
  const [showSimplifier, setShowSimplifier] = useState(false);
  const [selectedFont, setSelectedFont] = useState(() => {
    return localStorage.getItem('reader-font-preference') || FONT_OPTIONS[0].value;
  });
  const [selectedLineSpacing, setSelectedLineSpacing] = useState(() => {
    return localStorage.getItem('reader-line-spacing') || LINE_SPACING_OPTIONS[1].value;
  });
  const [selectedFontSize, setSelectedFontSize] = useState(() => {
    return localStorage.getItem('reader-font-size') || FONT_SIZE_OPTIONS[1].value;
  });
  const [showFontMenu, setShowFontMenu] = useState(false);
  const [showLineSpacingMenu, setShowLineSpacingMenu] = useState(false);
  const [showFontSizeMenu, setShowFontSizeMenu] = useState(false);
  const selectionTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!viewerRef.current || !bookData) return;

    let rend: Rendition | null = null;
    let isCleanedUp = false;

    const initBook = async () => {
      try {
        // Create book from ArrayBuffer with 'binary' option
        const book = new ePub(bookData, { openAs: 'binary' });
        
        // Wait for book to be ready before rendering
        await book.ready;
        
        if (isCleanedUp) return;
        
        rend = book.renderTo(viewerRef.current!, {
          width: '100%',
          height: '100%',
          flow: 'paginated',
        });

        await rend.display();
        if (isCleanedUp) return;
        
        console.log('Book displayed successfully');
        setRendition(rend);
      
      // Apply saved typography preferences
      const savedFont = localStorage.getItem('reader-font-preference') || FONT_OPTIONS[0].value;
      const savedLineSpacing = localStorage.getItem('reader-line-spacing') || LINE_SPACING_OPTIONS[1].value;
      const savedFontSize = localStorage.getItem('reader-font-size') || FONT_SIZE_OPTIONS[1].value;
      
        rend.themes.default({
        'body': { 
          'font-family': savedFont,
          'line-height': savedLineSpacing,
          'font-size': savedFontSize
        },
        'p': { 
          'font-family': savedFont,
          'line-height': savedLineSpacing,
          'font-size': savedFontSize
        },
        'div': { 
          'font-family': savedFont,
          'line-height': savedLineSpacing
        },
        'span': { 
          'font-family': savedFont
        },
        'h1, h2, h3, h4, h5, h6': { 
          'font-family': savedFont,
          'line-height': savedLineSpacing
        },
        'li': {
          'line-height': savedLineSpacing
        }
        });
        
        // Focus the container to ensure keyboard events work
        containerRef.current?.focus();

        const handleSelection = (e: unknown) => {
          const mouseEvent = e as MouseEvent;
          
          // Clear any existing timer
          if (selectionTimerRef.current) {
            clearTimeout(selectionTimerRef.current);
          }
          
          // Set a new timer to wait for selection to stabilize
          selectionTimerRef.current = setTimeout(() => {
            const contents = rend!.getContents();
            contents.forEach((content: Contents) => {
              const selection = content.window.getSelection();
              if (selection && selection.toString().trim()) {
                const text = selection.toString();
                setSelectedText(text);
                setSelectionPosition({ x: mouseEvent.clientX, y: mouseEvent.clientY });
                setShowSimplifier(true);
              }
            });
          }, 1000); // Wait 1 second after last selection event
        };

        rend.on('selected', handleSelection);

        // Use a hash of the book data for localStorage key
        const bookId = bookData.byteLength.toString();
        const savedLocation = localStorage.getItem(`book-location-${bookId}`);
        if (savedLocation && !isCleanedUp) {
          await rend.display(savedLocation);
        }

        rend.on('relocated', (location: unknown) => {
          const loc = location as { start: { cfi: string } };
          localStorage.setItem(`book-location-${bookId}`, loc.start.cfi);
        });
      } catch (error) {
        console.error('Error initializing book:', error);
        // Continue to display the book even if there are metadata errors
      }
    };

    initBook();

    return () => {
      isCleanedUp = true;
      if (selectionTimerRef.current) {
        clearTimeout(selectionTimerRef.current);
      }
      if (rend) {
        try {
          rend.destroy();
        } catch (error) {
          console.error('Error destroying rendition:', error);
        }
      }
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

  const applyTypographySettings = useCallback(() => {
    if (rendition) {
      rendition.themes.default({
        'body': { 
          'font-family': selectedFont,
          'line-height': selectedLineSpacing,
          'font-size': selectedFontSize
        },
        'p': { 
          'font-family': selectedFont,
          'line-height': selectedLineSpacing,
          'font-size': selectedFontSize
        },
        'div': { 
          'font-family': selectedFont,
          'line-height': selectedLineSpacing
        },
        'span': { 
          'font-family': selectedFont
        },
        'h1, h2, h3, h4, h5, h6': { 
          'font-family': selectedFont,
          'line-height': selectedLineSpacing
        },
        'li': {
          'line-height': selectedLineSpacing
        }
      });
    }
  }, [rendition, selectedFont, selectedLineSpacing, selectedFontSize]);

  const handleFontChange = useCallback((fontValue: string) => {
    setSelectedFont(fontValue);
    localStorage.setItem('reader-font-preference', fontValue);
    setShowFontMenu(false);
    containerRef.current?.focus();
  }, []);

  const handleLineSpacingChange = useCallback((spacing: string) => {
    setSelectedLineSpacing(spacing);
    localStorage.setItem('reader-line-spacing', spacing);
    setShowLineSpacingMenu(false);
    containerRef.current?.focus();
  }, []);

  const handleFontSizeChange = useCallback((size: string) => {
    setSelectedFontSize(size);
    localStorage.setItem('reader-font-size', size);
    setShowFontSizeMenu(false);
    containerRef.current?.focus();
  }, []);

  // Apply typography settings whenever they change
  useEffect(() => {
    applyTypographySettings();
  }, [applyTypographySettings]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') nextPage();
    if (e.key === 'ArrowLeft') prevPage();
    if (e.key === 'Escape') {
      if (showFontMenu || showLineSpacingMenu || showFontSizeMenu) {
        setShowFontMenu(false);
        setShowLineSpacingMenu(false);
        setShowFontSizeMenu(false);
      } else {
        setShowSimplifier(false);
      }
    }
  }, [nextPage, prevPage, showFontMenu, showLineSpacingMenu, showFontSizeMenu]);

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
        
        {/* Typography Controls */}
        <div className="flex items-center gap-2">
          {/* Font Selector */}
          <div className="relative">
            <button
              onClick={() => {
                setShowFontMenu(!showFontMenu);
                setShowLineSpacingMenu(false);
                setShowFontSizeMenu(false);
              }}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 bg-white/80 backdrop-blur rounded-lg flex items-center gap-2"
              aria-label="Change font"
            >
              <Type className="w-4 h-4" />
              <span className="hidden sm:inline">Font</span>
            </button>
            
            {showFontMenu && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-white/95 backdrop-blur-lg rounded-lg shadow-xl border border-gray-200/50 overflow-hidden">
                {FONT_OPTIONS.map((font) => (
                  <button
                    key={font.name}
                    onClick={() => handleFontChange(font.value)}
                    className={`w-full px-4 py-2.5 text-left text-sm hover:bg-gray-100/80 transition-colors ${
                      selectedFont === font.value ? 'bg-blue-50/80 text-blue-600' : 'text-gray-700'
                    }`}
                    style={{ fontFamily: font.value }}
                  >
                    {font.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Line Spacing Selector */}
          <div className="relative">
            <button
              onClick={() => {
                setShowLineSpacingMenu(!showLineSpacingMenu);
                setShowFontMenu(false);
                setShowFontSizeMenu(false);
              }}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 bg-white/80 backdrop-blur rounded-lg flex items-center gap-2"
              aria-label="Change line spacing"
            >
              <AlignJustify className="w-4 h-4" />
              <span className="hidden sm:inline">Spacing</span>
            </button>
            
            {showLineSpacingMenu && (
              <div className="absolute top-full right-0 mt-2 w-36 bg-white/95 backdrop-blur-lg rounded-lg shadow-xl border border-gray-200/50 overflow-hidden">
                {LINE_SPACING_OPTIONS.map((spacing) => (
                  <button
                    key={spacing.name}
                    onClick={() => handleLineSpacingChange(spacing.value)}
                    className={`w-full px-4 py-2.5 text-left text-sm hover:bg-gray-100/80 transition-colors ${
                      selectedLineSpacing === spacing.value ? 'bg-blue-50/80 text-blue-600' : 'text-gray-700'
                    }`}
                  >
                    {spacing.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Font Size Selector */}
          <div className="relative">
            <button
              onClick={() => {
                setShowFontSizeMenu(!showFontSizeMenu);
                setShowFontMenu(false);
                setShowLineSpacingMenu(false);
              }}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 bg-white/80 backdrop-blur rounded-lg flex items-center gap-2"
              aria-label="Change font size"
            >
              <AArrowUp className="w-4 h-4" />
              <span className="hidden sm:inline">Size</span>
            </button>
            
            {showFontSizeMenu && (
              <div className="absolute top-full right-0 mt-2 w-36 bg-white/95 backdrop-blur-lg rounded-lg shadow-xl border border-gray-200/50 overflow-hidden">
                {FONT_SIZE_OPTIONS.map((size) => (
                  <button
                    key={size.name}
                    onClick={() => handleFontSizeChange(size.value)}
                    className={`w-full px-4 py-2.5 text-left text-sm hover:bg-gray-100/80 transition-colors ${
                      selectedFontSize === size.value ? 'bg-blue-50/80 text-blue-600' : 'text-gray-700'
                    }`}
                  >
                    {size.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
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
          onClose={() => {
            setShowSimplifier(false);
            // Clear text selection in the epub reader
            if (rendition) {
              const contents = rendition.getContents();
              contents.forEach((content: Contents) => {
                const selection = content.window.getSelection();
                if (selection) {
                  selection.removeAllRanges();
                }
              });
            }
          }}
        />
      )}
    </div>
  );
}