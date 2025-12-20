'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import ePub from 'epubjs';
import type { Rendition, Contents } from 'epubjs';
import { ChevronLeft, ChevronRight, Type, AlignJustify, AArrowUp, Maximize2, Minimize2 } from 'lucide-react';
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
  const renditionRef = useRef<Rendition | null>(null);
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const selectionTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Focus container on mount to enable keyboard shortcuts immediately
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

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
        renditionRef.current = rend;

      
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

        // Focus the container to ensure keyboard events work after book loads
        // Multiple attempts to ensure focus is set
        requestAnimationFrame(() => {
          containerRef.current?.focus();
        });
        setTimeout(() => {
          if (document.activeElement !== containerRef.current) {
            containerRef.current?.focus();
            console.log('Focus set on container after book load');
          }
        }, 300);

        const handleSelection = (e: unknown) => {
          const mouseEvent = e as MouseEvent;
          
          // Clear any existing timer
          if (selectionTimerRef.current) {
            clearTimeout(selectionTimerRef.current);
          }
          
          // Check current selection to determine wait time
          let waitTime = 1000; // Default for multi-word selections
          const contents = rend!.getContents();
          contents.forEach((content: Contents) => {
            const selection = content.window.getSelection();
            if (selection && selection.toString().trim()) {
              const text = selection.toString().trim();
              // If single word (no spaces), use shorter wait time
              if (!text.includes(' ')) {
                waitTime = 200;
              }
            }
          });
          
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
          }, waitTime);
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
      renditionRef.current = null;
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
    renditionRef.current?.next();
  }, []);

  const prevPage = useCallback(() => {
    renditionRef.current?.prev();
  }, []);

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

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      // Enter fullscreen
      const elem = containerRef.current;
      if (elem?.requestFullscreen) {
        elem.requestFullscreen();
      }
    } else {
      // Exit fullscreen
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Skip if user is typing in an input or textarea
    const target = e.target as HTMLElement;
    if (target instanceof HTMLInputElement || 
        target instanceof HTMLTextAreaElement) {
      return;
    }

    // Arrow keys
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      renditionRef.current?.next();
      // Refocus container to maintain keyboard navigation
      containerRef.current?.focus();
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      renditionRef.current?.prev();
      // Refocus container to maintain keyboard navigation
      containerRef.current?.focus();
    }
    // F key for fullscreen
    if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      toggleFullscreen();
    }
    if (e.key === 'Escape') {
      if (showFontMenu || showLineSpacingMenu || showFontSizeMenu) {
        setShowFontMenu(false);
        setShowLineSpacingMenu(false);
        setShowFontSizeMenu(false);
      } else {
        setShowSimplifier(false);
      }
    }
  }, [showFontMenu, showLineSpacingMenu, showFontSizeMenu, toggleFullscreen]);

  useEffect(() => {
    // Use capture phase (true) to catch events before they reach iframes
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      // Simple focus restoration after exiting fullscreen
      if (!document.fullscreenElement) {
        setTimeout(() => {
          containerRef.current?.focus();
        }, 100);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 flex flex-col outline-none"
      style={{ background: 'var(--background)' }}
      tabIndex={0}
      autoFocus
    >
      {/* Minimal header - auto-hides */}
      <header
        className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 transition-opacity hover:opacity-100 opacity-0"
        style={{ background: 'linear-gradient(to bottom, var(--surface) 0%, transparent 100%)' }}
      >
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-sm font-medium backdrop-blur rounded-lg transition-colors"
          style={{ background: 'var(--surface)', color: 'var(--foreground-muted)', border: '1px solid var(--border-subtle)' }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--foreground)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--foreground-muted)'}
        >
          ← Back to Library
        </button>
        
        {/* Typography Controls and Fullscreen */}
        <div className="flex items-center gap-2">
          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="px-3 py-1.5 text-sm font-medium backdrop-blur rounded-lg flex items-center gap-2 transition-colors"
            style={{ background: 'var(--surface)', color: 'var(--foreground-muted)', border: '1px solid var(--border-subtle)' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--foreground)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--foreground-muted)'}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            title="Press F to toggle fullscreen"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">
              {isFullscreen ? 'Exit' : 'Fullscreen'}
            </span>
          </button>

          <div className="w-px h-6 hidden sm:block" style={{ background: 'var(--border)' }} />
          {/* Font Selector */}
          <div className="relative">
            <button
              onClick={() => {
                setShowFontMenu(!showFontMenu);
                setShowLineSpacingMenu(false);
                setShowFontSizeMenu(false);
              }}
              className="px-3 py-1.5 text-sm font-medium backdrop-blur rounded-lg flex items-center gap-2 transition-colors"
              style={{ background: 'var(--surface)', color: 'var(--foreground-muted)', border: '1px solid var(--border-subtle)' }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--foreground)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--foreground-muted)'}
              aria-label="Change font"
            >
              <Type className="w-4 h-4" />
              <span className="hidden sm:inline">Font</span>
            </button>

            {showFontMenu && (
              <div
                className="absolute top-full right-0 mt-2 w-48 backdrop-blur-lg rounded-lg overflow-hidden"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(45, 42, 38, 0.15)' }}
              >
                {FONT_OPTIONS.map((font) => (
                  <button
                    key={font.name}
                    onClick={() => handleFontChange(font.value)}
                    className="w-full px-4 py-2.5 text-left text-sm transition-colors"
                    style={{
                      fontFamily: font.value,
                      background: selectedFont === font.value ? 'var(--accent-subtle)' : 'transparent',
                      color: selectedFont === font.value ? 'var(--accent)' : 'var(--foreground)'
                    }}
                    onMouseEnter={(e) => {
                      if (selectedFont !== font.value) e.currentTarget.style.background = 'var(--background-muted)';
                    }}
                    onMouseLeave={(e) => {
                      if (selectedFont !== font.value) e.currentTarget.style.background = 'transparent';
                    }}
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
              className="px-3 py-1.5 text-sm font-medium backdrop-blur rounded-lg flex items-center gap-2 transition-colors"
              style={{ background: 'var(--surface)', color: 'var(--foreground-muted)', border: '1px solid var(--border-subtle)' }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--foreground)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--foreground-muted)'}
              aria-label="Change line spacing"
            >
              <AlignJustify className="w-4 h-4" />
              <span className="hidden sm:inline">Spacing</span>
            </button>

            {showLineSpacingMenu && (
              <div
                className="absolute top-full right-0 mt-2 w-36 backdrop-blur-lg rounded-lg overflow-hidden"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(45, 42, 38, 0.15)' }}
              >
                {LINE_SPACING_OPTIONS.map((spacing) => (
                  <button
                    key={spacing.name}
                    onClick={() => handleLineSpacingChange(spacing.value)}
                    className="w-full px-4 py-2.5 text-left text-sm transition-colors"
                    style={{
                      background: selectedLineSpacing === spacing.value ? 'var(--accent-subtle)' : 'transparent',
                      color: selectedLineSpacing === spacing.value ? 'var(--accent)' : 'var(--foreground)'
                    }}
                    onMouseEnter={(e) => {
                      if (selectedLineSpacing !== spacing.value) e.currentTarget.style.background = 'var(--background-muted)';
                    }}
                    onMouseLeave={(e) => {
                      if (selectedLineSpacing !== spacing.value) e.currentTarget.style.background = 'transparent';
                    }}
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
              className="px-3 py-1.5 text-sm font-medium backdrop-blur rounded-lg flex items-center gap-2 transition-colors"
              style={{ background: 'var(--surface)', color: 'var(--foreground-muted)', border: '1px solid var(--border-subtle)' }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--foreground)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--foreground-muted)'}
              aria-label="Change font size"
            >
              <AArrowUp className="w-4 h-4" />
              <span className="hidden sm:inline">Size</span>
            </button>

            {showFontSizeMenu && (
              <div
                className="absolute top-full right-0 mt-2 w-36 backdrop-blur-lg rounded-lg overflow-hidden"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(45, 42, 38, 0.15)' }}
              >
                {FONT_SIZE_OPTIONS.map((size) => (
                  <button
                    key={size.name}
                    onClick={() => handleFontSizeChange(size.value)}
                    className="w-full px-4 py-2.5 text-left text-sm transition-colors"
                    style={{
                      background: selectedFontSize === size.value ? 'var(--accent-subtle)' : 'transparent',
                      color: selectedFontSize === size.value ? 'var(--accent)' : 'var(--foreground)'
                    }}
                    onMouseEnter={(e) => {
                      if (selectedFontSize !== size.value) e.currentTarget.style.background = 'var(--background-muted)';
                    }}
                    onMouseLeave={(e) => {
                      if (selectedFontSize !== size.value) e.currentTarget.style.background = 'transparent';
                    }}
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
            className="p-2 rounded-full transition-all hover:scale-105"
            style={{ background: 'var(--surface)', boxShadow: '0 4px 16px rgba(45, 42, 38, 0.1)', border: '1px solid var(--border-subtle)' }}
            aria-label="Previous page"
          >
            <ChevronLeft className="w-5 h-5" style={{ color: 'var(--foreground-muted)' }} />
          </button>

          <button
            onClick={nextPage}
            className="p-2 rounded-full transition-all hover:scale-105"
            style={{ background: 'var(--surface)', boxShadow: '0 4px 16px rgba(45, 42, 38, 0.1)', border: '1px solid var(--border-subtle)' }}
            aria-label="Next page"
          >
            <ChevronRight className="w-5 h-5" style={{ color: 'var(--foreground-muted)' }} />
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