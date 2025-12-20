'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import ePub from 'epubjs';
import type { Rendition, Contents, TocItem } from 'epubjs';
import { ChevronLeft, ChevronRight, Settings, Type, AlignJustify, AArrowUp, Maximize2, Minimize2, List } from 'lucide-react';
import Simplifier from './Simplifier';
import ChapterNav from './ChapterNav';
import { useChat } from '../contexts/ChatContext';
import { ChatMessage } from '../types/chat';

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

  // Chat integration
  const { startConversation, setIsExpanded, isExpanded } = useChat();
  const [selectedFont, setSelectedFont] = useState(() => {
    return localStorage.getItem('reader-font-preference') || FONT_OPTIONS[0].value;
  });
  const [selectedLineSpacing, setSelectedLineSpacing] = useState(() => {
    return localStorage.getItem('reader-line-spacing') || LINE_SPACING_OPTIONS[1].value;
  });
  const [selectedFontSize, setSelectedFontSize] = useState(() => {
    return localStorage.getItem('reader-font-size') || FONT_SIZE_OPTIONS[1].value;
  });
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const selectionTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Chapter navigation state
  const [tableOfContents, setTableOfContents] = useState<TocItem[]>([]);
  const [showChapterNav, setShowChapterNav] = useState(false);
  const [currentHref, setCurrentHref] = useState('');
  const [pageNumbers, setPageNumbers] = useState<Map<string, number>>(new Map());
  const bookRef = useRef<ePub | null>(null);

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
        bookRef.current = book;

        // Extract table of contents
        if (book.navigation && book.navigation.toc) {
          setTableOfContents(book.navigation.toc);
        }

        // Generate locations for page numbers (in background)
        const bookId = bookData.byteLength.toString();
        const cachedLocations = localStorage.getItem(`book-locations-${bookId}`);

        if (cachedLocations) {
          try {
            book.locations.load(cachedLocations);
            generatePageNumbers(book);
          } catch {
            // Regenerate if cache is invalid
            generateLocationsInBackground(book, bookId);
          }
        } else {
          generateLocationsInBackground(book, bookId);
        }

        // Helper to generate locations in background
        async function generateLocationsInBackground(book: ePub, bookId: string) {
          try {
            await book.locations.generate(1024);
            localStorage.setItem(`book-locations-${bookId}`, book.locations.save());
            generatePageNumbers(book);
          } catch (error) {
            console.error('Error generating locations:', error);
          }
        }

        // Helper to calculate page numbers for TOC items
        function generatePageNumbers(book: ePub) {
          if (!book.navigation?.toc || !book.locations?.total) return;

          const pages = new Map<string, number>();
          const totalLocations = book.locations.total;

          function processItems(items: TocItem[]) {
            items.forEach((item) => {
              try {
                const spineItem = book.spine.get(item.href);
                if (spineItem?.cfi) {
                  const location = book.locations.locationFromCfi(spineItem.cfi);
                  // Convert location to approximate page (assuming ~250 words per page)
                  const pageNum = Math.max(1, Math.ceil((location / totalLocations) * Math.ceil(totalLocations / 3)));
                  pages.set(item.href, pageNum);
                }
              } catch {
                // Skip items that can't be resolved
              }
              if (item.subitems) {
                processItems(item.subitems);
              }
            });
          }

          processItems(book.navigation.toc);
          setPageNumbers(pages);
        }

        // Apply saved typography preferences
      const savedFont = localStorage.getItem('reader-font-preference') || FONT_OPTIONS[0].value;
      const savedLineSpacing = localStorage.getItem('reader-line-spacing') || LINE_SPACING_OPTIONS[1].value;
      const savedFontSize = localStorage.getItem('reader-font-size') || FONT_SIZE_OPTIONS[1].value;
      
        // Warm charcoal text color for book content
        const textColor = '#2D2A26';

        rend.themes.default({
        'body': {
          'font-family': savedFont,
          'line-height': savedLineSpacing,
          'font-size': savedFontSize,
          'color': textColor,
          'background': '#FFFCF7'
        },
        'p': {
          'font-family': savedFont,
          'line-height': savedLineSpacing,
          'font-size': savedFontSize,
          'color': textColor
        },
        'div': {
          'font-family': savedFont,
          'line-height': savedLineSpacing,
          'color': textColor
        },
        'span': {
          'font-family': savedFont,
          'color': textColor
        },
        'h1, h2, h3, h4, h5, h6': {
          'font-family': savedFont,
          'line-height': savedLineSpacing,
          'color': textColor
        },
        'li': {
          'line-height': savedLineSpacing,
          'color': textColor
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
              if (selection && selection.toString().trim() && selection.rangeCount > 0) {
                const text = selection.toString();
                setSelectedText(text);

                // Get position from selection range, not mouse position
                const range = selection.getRangeAt(0);
                const rect = range.getBoundingClientRect();

                // The rect is relative to the iframe, need to adjust for iframe position
                const iframe = content.document.defaultView?.frameElement;
                if (iframe) {
                  const iframeRect = iframe.getBoundingClientRect();
                  // Position above the selection, horizontally centered
                  // Pass the TOP of the selection so popup appears above it
                  setSelectionPosition({
                    x: iframeRect.left + rect.left + rect.width / 2,
                    y: iframeRect.top + rect.top
                  });
                } else {
                  // Fallback to mouse position if iframe not found
                  setSelectionPosition({ x: mouseEvent.clientX, y: mouseEvent.clientY });
                }
                setShowSimplifier(true);
              }
            });
          }, waitTime);
        };

        rend.on('selected', handleSelection);

        // Use bookId (already defined above) for localStorage
        const savedLocation = localStorage.getItem(`book-location-${bookId}`);
        if (savedLocation && !isCleanedUp) {
          await rend.display(savedLocation);
        }

        rend.on('relocated', (location: unknown) => {
          const loc = location as { start: { cfi: string; href: string } };
          localStorage.setItem(`book-location-${bookId}`, loc.start.cfi);
          // Track current href for chapter highlighting
          if (loc.start.href) {
            setCurrentHref(loc.start.href);
          }
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
      // Warm charcoal text color for book content
      const textColor = '#2D2A26';

      rendition.themes.default({
        'body': {
          'font-family': selectedFont,
          'line-height': selectedLineSpacing,
          'font-size': selectedFontSize,
          'color': textColor,
          'background': '#FFFCF7'
        },
        'p': {
          'font-family': selectedFont,
          'line-height': selectedLineSpacing,
          'font-size': selectedFontSize,
          'color': textColor
        },
        'div': {
          'font-family': selectedFont,
          'line-height': selectedLineSpacing,
          'color': textColor
        },
        'span': {
          'font-family': selectedFont,
          'color': textColor
        },
        'h1, h2, h3, h4, h5, h6': {
          'font-family': selectedFont,
          'line-height': selectedLineSpacing,
          'color': textColor
        },
        'li': {
          'line-height': selectedLineSpacing,
          'color': textColor
        }
      });
    }
  }, [rendition, selectedFont, selectedLineSpacing, selectedFontSize]);

  const handleFontChange = useCallback((fontValue: string) => {
    setSelectedFont(fontValue);
    localStorage.setItem('reader-font-preference', fontValue);
  }, []);

  const handleLineSpacingChange = useCallback((spacing: string) => {
    setSelectedLineSpacing(spacing);
    localStorage.setItem('reader-line-spacing', spacing);
  }, []);

  const handleFontSizeChange = useCallback((size: string) => {
    setSelectedFontSize(size);
    localStorage.setItem('reader-font-size', size);
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

  // Handle chapter navigation
  const handleChapterNavigate = useCallback((href: string) => {
    if (renditionRef.current) {
      renditionRef.current.display(href);
      setShowChapterNav(false); // Auto-close after selection
    }
  }, []);

  // Handle expanding to chat panel
  const handleExpandToChat = useCallback((originalText: string, messages: ChatMessage[]) => {
    // Start the conversation in the chat context
    if (messages.length > 0) {
      startConversation(originalText, messages[0].content);
      // Add remaining messages
      messages.slice(1).forEach(() => {
        // Note: We'd need to add these through the context, but for now just expand
      });
    }
    setIsExpanded(true);
    // Resize the epub rendition after the panel opens
    setTimeout(() => {
      if (renditionRef.current && viewerRef.current) {
        const { width, height } = viewerRef.current.getBoundingClientRect();
        renditionRef.current.resize(width, height);
      }
    }, 350);
  }, [startConversation, setIsExpanded]);

  // Resize epub when chat panel expands/collapses
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (renditionRef.current && viewerRef.current) {
        const { width, height } = viewerRef.current.getBoundingClientRect();
        renditionRef.current.resize(width, height);
      }
    }, 350);
    return () => clearTimeout(timeout);
  }, [isExpanded]);

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
    // T key for table of contents
    if (e.key === 't' || e.key === 'T') {
      e.preventDefault();
      setShowChapterNav(prev => !prev);
    }
    if (e.key === 'Escape') {
      if (showChapterNav) {
        setShowChapterNav(false);
      } else if (showSettingsMenu) {
        setShowSettingsMenu(false);
      } else {
        setShowSimplifier(false);
      }
    }
  }, [showSettingsMenu, showChapterNav, toggleFullscreen]);

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
      className="relative h-full w-full flex flex-col outline-none"
      style={{ background: 'var(--background)' }}
      tabIndex={0}
      autoFocus
    >
      {/* Minimal header - auto-hides */}
      <header
        className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 transition-opacity hover:opacity-100 opacity-0"
        style={{ background: 'linear-gradient(to bottom, var(--surface) 0%, transparent 100%)' }}
      >
        <div className="flex items-center gap-2">
          {/* Table of Contents button */}
          <button
            onClick={() => setShowChapterNav(!showChapterNav)}
            className="p-2 backdrop-blur rounded-lg transition-colors"
            style={{ background: 'var(--surface)', color: 'var(--foreground-muted)', border: '1px solid var(--border-subtle)' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--foreground)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--foreground-muted)'}
            aria-label="Table of Contents"
          >
            <List className="w-5 h-5" />
          </button>

          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm font-medium backdrop-blur rounded-lg transition-colors"
            style={{ background: 'var(--surface)', color: 'var(--foreground-muted)', border: '1px solid var(--border-subtle)' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--foreground)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--foreground-muted)'}
          >
            ← Back to Library
          </button>
        </div>

        {/* Collapsed Settings Menu (Apple Books style) */}
        <div className="relative">
          <button
            onClick={() => setShowSettingsMenu(!showSettingsMenu)}
            className="p-2 backdrop-blur rounded-lg transition-colors"
            style={{ background: 'var(--surface)', color: 'var(--foreground-muted)', border: '1px solid var(--border-subtle)' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--foreground)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--foreground-muted)'}
            aria-label="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>

          {showSettingsMenu && (
            <div
              className="absolute top-full right-0 mt-2 w-64 backdrop-blur-lg rounded-lg overflow-hidden"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(45, 42, 38, 0.15)' }}
            >
              {/* Fullscreen */}
              <button
                onClick={() => { toggleFullscreen(); setShowSettingsMenu(false); }}
                className="w-full px-4 py-3 text-left text-sm flex items-center gap-3 transition-colors"
                style={{ color: 'var(--foreground)', borderBottom: '1px solid var(--border-subtle)' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--background-muted)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              </button>

              {/* Font Section */}
              <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <div className="text-xs font-medium mb-2 flex items-center gap-2" style={{ color: 'var(--foreground-muted)' }}>
                  <Type className="w-3 h-3" /> Font
                </div>
                <div className="flex flex-wrap gap-1">
                  {FONT_OPTIONS.map((font) => (
                    <button
                      key={font.name}
                      onClick={() => handleFontChange(font.value)}
                      className="px-2 py-1 text-xs rounded transition-colors"
                      style={{
                        background: selectedFont === font.value ? 'var(--accent)' : 'var(--background)',
                        color: selectedFont === font.value ? 'white' : 'var(--foreground-muted)'
                      }}
                    >
                      {font.name.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Size Section */}
              <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <div className="text-xs font-medium mb-2 flex items-center gap-2" style={{ color: 'var(--foreground-muted)' }}>
                  <AArrowUp className="w-3 h-3" /> Size
                </div>
                <div className="flex gap-1">
                  {FONT_SIZE_OPTIONS.map((size) => (
                    <button
                      key={size.name}
                      onClick={() => handleFontSizeChange(size.value)}
                      className="px-2 py-1 text-xs rounded transition-colors"
                      style={{
                        background: selectedFontSize === size.value ? 'var(--accent)' : 'var(--background)',
                        color: selectedFontSize === size.value ? 'white' : 'var(--foreground-muted)'
                      }}
                    >
                      {size.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Spacing Section */}
              <div className="px-4 py-3">
                <div className="text-xs font-medium mb-2 flex items-center gap-2" style={{ color: 'var(--foreground-muted)' }}>
                  <AlignJustify className="w-3 h-3" /> Spacing
                </div>
                <div className="flex gap-1">
                  {LINE_SPACING_OPTIONS.map((spacing) => (
                    <button
                      key={spacing.name}
                      onClick={() => handleLineSpacingChange(spacing.value)}
                      className="px-2 py-1 text-xs rounded transition-colors"
                      style={{
                        background: selectedLineSpacing === spacing.value ? 'var(--accent)' : 'var(--background)',
                        color: selectedLineSpacing === spacing.value ? 'white' : 'var(--foreground-muted)'
                      }}
                    >
                      {spacing.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 relative">
        <div ref={viewerRef} className="w-full h-full" />
        
        {/* Visible navigation buttons at bottom */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4 z-10" style={{ position: 'absolute' }}>
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
          onExpand={handleExpandToChat}
        />
      )}

      {/* Chapter Navigation Sidebar */}
      <ChapterNav
        toc={tableOfContents}
        currentHref={currentHref}
        onNavigate={handleChapterNavigate}
        onClose={() => setShowChapterNav(false)}
        isOpen={showChapterNav}
        pageNumbers={pageNumbers}
      />
    </div>
  );
}