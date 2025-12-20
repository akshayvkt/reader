'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import ePub from 'epubjs';
import type { Rendition, Contents, TocItem } from 'epubjs';
import { ChevronLeft, ChevronRight, Settings, Type, AlignJustify, Maximize2, Minimize2, List, Search, X, Sun, Moon, Monitor } from 'lucide-react';
import Simplifier from './Simplifier';
import ChapterNav from './ChapterNav';
import { useChat } from '../contexts/ChatContext';
import { ChatMessage } from '../types/chat';
import { addRecentBook, updateBookProgress } from '../lib/libraryStorage';

export interface BookReaderProps {
  bookData: ArrayBuffer;
  filePath?: string;
  onClose: () => void;
}

const FONT_OPTIONS = [
  { name: 'Charter', value: 'Charter, "Bitstream Charter", Georgia, serif' },
  { name: 'Merriweather', value: '"Merriweather", Georgia, serif' },
  { name: 'Georgia', value: 'Georgia, serif' },
  { name: 'System Default', value: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' },
  { name: 'Arial', value: 'Arial, sans-serif' },
  { name: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { name: 'Open Dyslexic', value: '"OpenDyslexic", Arial, sans-serif' },
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
  { name: 'Larger', value: '22px' },
  { name: 'Largest', value: '24px' },
];

interface SearchResult {
  cfi: string;
  excerpt: string;
  chapterTitle: string;
  pageNumber?: number;
}

export default function BookReader({ bookData, filePath, onClose }: BookReaderProps) {
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
    return localStorage.getItem('reader-font-preference') || FONT_OPTIONS[0].value; // Charter
  });
  const [selectedLineSpacing, setSelectedLineSpacing] = useState(() => {
    return localStorage.getItem('reader-line-spacing') || LINE_SPACING_OPTIONS[2].value; // Relaxed (1.8)
  });
  const [selectedFontSize, setSelectedFontSize] = useState(() => {
    return localStorage.getItem('reader-font-size') || FONT_SIZE_OPTIONS[2].value; // Large (18px)
  });
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showFontDropdown, setShowFontDropdown] = useState(false);
  const [showSizeDots, setShowSizeDots] = useState(false);
  const sizeDotsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const selectionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const settingsMenuRef = useRef<HTMLDivElement>(null);

  // Chapter navigation state
  const [tableOfContents, setTableOfContents] = useState<TocItem[]>([]);
  const [showChapterNav, setShowChapterNav] = useState(false);
  const [currentHref, setCurrentHref] = useState('');
  const [pageNumbers, setPageNumbers] = useState<Map<string, number>>(new Map());
  const bookRef = useRef<ePub | null>(null);

  // Search state
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Page transition state - simple fade
  const [isTransitioning, setIsTransitioning] = useState(false);
  const FADE_DURATION = 150; // ms - quick and clean
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchPanelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Theme state
  const [theme, setTheme] = useState<'auto' | 'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('reader-theme') as 'auto' | 'light' | 'dark') || 'auto';
    }
    return 'auto';
  });
  const [systemPrefersDark, setSystemPrefersDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Compute effective theme (what's actually displayed)
  const effectiveTheme = theme === 'auto' ? (systemPrefersDark ? 'dark' : 'light') : theme;

  // Focus container on mount to enable keyboard shortcuts immediately
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'auto') {
      // Remove data-theme to let media query handle it
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', theme);
    }
    localStorage.setItem('reader-theme', theme);
  }, [theme]);

  // Listen for system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setSystemPrefersDark(e.matches);
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Close settings menu when clicking outside
  useEffect(() => {
    if (!showSettingsMenu) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(e.target as Node)) {
        setShowSettingsMenu(false);
        setShowFontDropdown(false);
        containerRef.current?.focus();
      }
    };

    // Small delay to prevent immediate close on the same click that opened it
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 10);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSettingsMenu]);

  // Close search panel when clicking outside
  useEffect(() => {
    if (!showSearchPanel) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (searchPanelRef.current && !searchPanelRef.current.contains(e.target as Node)) {
        setShowSearchPanel(false);
        containerRef.current?.focus();
      }
    };

    // Small delay to prevent immediate close on the same click that opened it
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 10);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSearchPanel]);

  // Auto-focus search input when panel opens
  useEffect(() => {
    if (showSearchPanel && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearchPanel]);

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

        // Book ID for localStorage
        const bookId = bookData.byteLength.toString();

        // Save book to recent library
        try {
          const metadata = await book.loaded.metadata;
          const blobCoverUrl = await book.coverUrl();

          // Convert blob URL to base64 data URL for persistence
          let coverDataUrl: string | null = null;
          if (blobCoverUrl) {
            try {
              const response = await fetch(blobCoverUrl);
              const blob = await response.blob();
              coverDataUrl = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
              });
            } catch (coverError) {
              console.error('Error converting cover to base64:', coverError);
            }
          }

          addRecentBook({
            id: bookId,
            title: metadata?.title || 'Untitled',
            author: metadata?.creator || 'Unknown Author',
            coverUrl: coverDataUrl,
            lastOpened: Date.now(),
            progress: 0,
            fileType: 'epub',
            filePath: filePath,
          });
        } catch (error) {
          console.error('Error saving book metadata:', error);
        }

        // Generate locations for page numbers (in background)
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
      const savedFont = localStorage.getItem('reader-font-preference') || FONT_OPTIONS[0].value; // Charter
      const savedLineSpacing = localStorage.getItem('reader-line-spacing') || LINE_SPACING_OPTIONS[2].value; // Relaxed
      const savedFontSize = localStorage.getItem('reader-font-size') || FONT_SIZE_OPTIONS[2].value; // Large

        // Get theme colors from CSS variables
        const styles = getComputedStyle(document.documentElement);
        const textColor = styles.getPropertyValue('--foreground').trim();
        const backgroundColor = styles.getPropertyValue('--surface').trim();

        rend.themes.default({
        'body': {
          'font-family': savedFont,
          'line-height': savedLineSpacing,
          'font-size': savedFontSize,
          'color': textColor,
          'background': backgroundColor
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

        // Close panels when clicking on epub content (inside iframe)
        // Use hooks.content to access each iframe's document directly
        rend.hooks.content.register((contents: Contents) => {
          contents.document.addEventListener('click', () => {
            setShowSettingsMenu(false);
            setShowSearchPanel(false);
            setShowFontDropdown(false);
            // Restore focus to container for keyboard navigation
            setTimeout(() => containerRef.current?.focus(), 0);
          });
        });

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
          // Update progress in library
          try {
            if (book.locations?.total) {
              const percentage = book.locations.percentageFromCfi(loc.start.cfi);
              updateBookProgress(bookId, Math.round(percentage * 100), loc.start.cfi);
            }
          } catch {
            // Locations may not be ready yet
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
      if (sizeDotsTimerRef.current) {
        clearTimeout(sizeDotsTimerRef.current);
      }
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
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
  }, [bookData, filePath]);

  const nextPage = useCallback(() => {
    if (isTransitioning) return;

    setIsTransitioning(true);

    // Fade out, swap content, then appear
    setTimeout(() => {
      renditionRef.current?.next();
      setIsTransitioning(false);
    }, FADE_DURATION);
  }, [isTransitioning]);

  const prevPage = useCallback(() => {
    if (isTransitioning) return;

    setIsTransitioning(true);

    // Fade out, swap content, then appear
    setTimeout(() => {
      renditionRef.current?.prev();
      setIsTransitioning(false);
    }, FADE_DURATION);
  }, [isTransitioning]);

  // Get current theme colors from CSS variables
  const getThemeColors = useCallback(() => {
    const styles = getComputedStyle(document.documentElement);
    return {
      textColor: styles.getPropertyValue('--foreground').trim(),
      backgroundColor: styles.getPropertyValue('--surface').trim(),
    };
  }, []);

  const applyTypographySettings = useCallback(() => {
    if (rendition) {
      // Get theme colors from CSS variables
      const { textColor, backgroundColor } = getThemeColors();

      rendition.themes.default({
        'body': {
          'font-family': selectedFont,
          'line-height': selectedLineSpacing,
          'font-size': selectedFontSize,
          'color': textColor,
          'background': backgroundColor
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
  }, [rendition, selectedFont, selectedLineSpacing, selectedFontSize, getThemeColors]);

  const handleFontChange = useCallback((fontValue: string) => {
    setSelectedFont(fontValue);
    localStorage.setItem('reader-font-preference', fontValue);
  }, []);

  const handleLineSpacingChange = useCallback((spacing: string) => {
    setSelectedLineSpacing(spacing);
    localStorage.setItem('reader-line-spacing', spacing);
  }, []);

  const showSizeDotsTemporarily = useCallback(() => {
    // Clear any existing timer
    if (sizeDotsTimerRef.current) {
      clearTimeout(sizeDotsTimerRef.current);
    }
    // Show dots
    setShowSizeDots(true);
    // Hide after 1.5 seconds
    sizeDotsTimerRef.current = setTimeout(() => {
      setShowSizeDots(false);
    }, 1500);
  }, []);

  const decreaseFontSize = useCallback(() => {
    const currentIndex = FONT_SIZE_OPTIONS.findIndex(opt => opt.value === selectedFontSize);
    if (currentIndex > 0) {
      const newSize = FONT_SIZE_OPTIONS[currentIndex - 1].value;
      setSelectedFontSize(newSize);
      localStorage.setItem('reader-font-size', newSize);
      showSizeDotsTemporarily();
    }
  }, [selectedFontSize, showSizeDotsTemporarily]);

  const increaseFontSize = useCallback(() => {
    const currentIndex = FONT_SIZE_OPTIONS.findIndex(opt => opt.value === selectedFontSize);
    if (currentIndex < FONT_SIZE_OPTIONS.length - 1) {
      const newSize = FONT_SIZE_OPTIONS[currentIndex + 1].value;
      setSelectedFontSize(newSize);
      localStorage.setItem('reader-font-size', newSize);
      showSizeDotsTemporarily();
    }
  }, [selectedFontSize, showSizeDotsTemporarily]);

  // Apply typography settings whenever they change (including theme)
  useEffect(() => {
    applyTypographySettings();
  }, [applyTypographySettings, effectiveTheme]);

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
      containerRef.current?.focus(); // Restore focus for keyboard navigation
    }
  }, []);

  // Helper to find chapter title from CFI
  const getChapterTitleFromCfi = useCallback((cfi: string): string => {
    if (!bookRef.current || !tableOfContents.length) return 'Unknown';

    try {
      // Extract the spine item index from CFI (format: epubcfi(/6/N!...))
      const match = cfi.match(/epubcfi\(\/6\/(\d+)/);
      if (!match) return 'Unknown';

      const spineIndex = Math.floor(parseInt(match[1]) / 2) - 1;
      const spineItem = bookRef.current.spine.get(spineIndex);
      if (!spineItem) return 'Unknown';

      const href = spineItem.href;

      // Search TOC for matching href
      const findInToc = (items: TocItem[]): string | null => {
        for (const item of items) {
          const itemHref = item.href.split('#')[0];
          if (href.includes(itemHref) || itemHref.includes(href)) {
            return item.label;
          }
          if (item.subitems) {
            const found = findInToc(item.subitems);
            if (found) return found;
          }
        }
        return null;
      };

      return findInToc(tableOfContents) || 'Unknown';
    } catch {
      return 'Unknown';
    }
  }, [tableOfContents]);

  // Search function with debounce
  const performSearch = useCallback(async (query: string) => {
    if (!bookRef.current || query.length < 3) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    try {
      const book = bookRef.current;
      const allResults: { cfi: string; excerpt: string }[] = [];

      // Search through each spine item
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const spine = book.spine as any;

      for (const item of spine.spineItems) {
        try {
          // Load the section if not already loaded
          await item.load(book.load.bind(book));

          // Find matches in this section
          const found = await item.find(query);
          if (found && found.length > 0) {
            allResults.push(...found);
          }

          // Unload to free memory
          item.unload();

          // Stop if we have enough results
          if (allResults.length >= 50) break;
        } catch {
          // Skip sections that fail to load
          continue;
        }
      }

      // Map results to include chapter titles, limit to 50
      const mappedResults: SearchResult[] = allResults.slice(0, 50).map((result) => ({
        cfi: result.cfi,
        excerpt: result.excerpt,
        chapterTitle: getChapterTitleFromCfi(result.cfi),
        pageNumber: undefined,
      }));

      setSearchResults(mappedResults);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [getChapterTitleFromCfi]);

  // Handle search input change with debounce
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);

    // Clear existing debounce timer
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    if (value.length < 3) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    // Set searching state immediately for feedback
    setIsSearching(true);

    // Debounce the actual search
    searchDebounceRef.current = setTimeout(() => {
      performSearch(value);
    }, 300);
  }, [performSearch]);

  // Handle clicking a search result
  const handleSearchResultClick = useCallback((cfi: string) => {
    if (renditionRef.current) {
      renditionRef.current.display(cfi);
      setShowSearchPanel(false);
      setSearchQuery('');
      setSearchResults([]);
      containerRef.current?.focus(); // Restore focus for keyboard navigation
    }
  }, []);

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setIsSearching(false);
    searchInputRef.current?.focus();
  }, []);

  // Handle expanding to chat panel
  const handleExpandToChat = useCallback((originalText: string, messages: ChatMessage[]) => {
    // Start the conversation in the chat context with all existing messages
    if (messages.length > 0) {
      startConversation(originalText, messages[0].content, undefined, messages);
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
    const target = e.target as HTMLElement;

    // Handle Escape key even when in input (to close search panel)
    if (e.key === 'Escape') {
      if (showSearchPanel) {
        setShowSearchPanel(false);
        setSearchQuery('');
        setSearchResults([]);
        containerRef.current?.focus();
      } else if (showChapterNav) {
        setShowChapterNav(false);
      } else if (showSettingsMenu) {
        setShowSettingsMenu(false);
      } else {
        setShowSimplifier(false);
      }
      return;
    }

    // Skip other keys if user is typing in an input or textarea
    if (target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement) {
      return;
    }

    // Arrow keys
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      nextPage();
      // Refocus container to maintain keyboard navigation
      containerRef.current?.focus();
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      prevPage();
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
  }, [showSettingsMenu, showChapterNav, showSearchPanel, toggleFullscreen, nextPage, prevPage]);

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

  // Restore focus when window regains focus (returning from another app)
  useEffect(() => {
    const handleWindowFocus = () => {
      setTimeout(() => {
        // Only restore if no input is focused and no panel with input is open
        const activeEl = document.activeElement;
        const isInputFocused = activeEl instanceof HTMLInputElement ||
                               activeEl instanceof HTMLTextAreaElement;
        if (!isInputFocused && !showSearchPanel) {
          containerRef.current?.focus();
        }
      }, 100);
    };

    window.addEventListener('focus', handleWindowFocus);
    return () => window.removeEventListener('focus', handleWindowFocus);
  }, [showSearchPanel]);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full flex flex-col outline-none"
      style={{ background: 'var(--background)' }}
      tabIndex={0}
      autoFocus
    >
      {/* Minimal header - auto-hides, stays visible when panels are open */}
      <header
        className={`absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 transition-opacity hover:opacity-100 ${showSettingsMenu || showSearchPanel ? 'opacity-100' : 'opacity-0'}`}
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

        {/* Search and Settings */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative" ref={searchPanelRef}>
            <button
              onClick={() => setShowSearchPanel(!showSearchPanel)}
              className="p-2 backdrop-blur rounded-lg transition-colors"
              style={{ background: 'var(--surface)', color: 'var(--foreground-muted)', border: '1px solid var(--border-subtle)' }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--foreground)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--foreground-muted)'}
              aria-label="Search"
            >
              <Search className="w-5 h-5" />
            </button>

            {showSearchPanel && (
              <div
                className="absolute top-full right-0 mt-2 w-80 backdrop-blur-lg rounded-lg"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(45, 42, 38, 0.15)' }}
              >
                {/* Search Input */}
                <div className="p-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <Search className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--foreground-muted)' }} />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder="Search in book"
                    className="flex-1 bg-transparent text-sm outline-none"
                    style={{ color: 'var(--foreground)' }}
                  />
                  {searchQuery && (
                    <button
                      onClick={clearSearch}
                      className="p-1 rounded-full transition-colors"
                      style={{ color: 'var(--foreground-muted)' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--foreground)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--foreground-muted)'}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Search Results */}
                <div className="max-h-80 overflow-y-auto">
                  {isSearching ? (
                    <div className="px-4 py-8 text-center">
                      <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                        Searching...
                      </div>
                    </div>
                  ) : searchQuery.length > 0 && searchQuery.length < 3 ? (
                    <div className="px-4 py-8 text-center">
                      <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                        Type at least 3 characters
                      </div>
                    </div>
                  ) : searchResults.length > 0 ? (
                    searchResults.map((result, index) => (
                      <button
                        key={index}
                        onClick={() => handleSearchResultClick(result.cfi)}
                        className="w-full px-4 py-3 text-left transition-colors"
                        style={{ borderBottom: '1px solid var(--border-subtle)' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--background-muted)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>
                            {result.chapterTitle}
                          </div>
                          {result.pageNumber && (
                            <div className="text-xs flex-shrink-0" style={{ color: 'var(--foreground-muted)' }}>
                              {result.pageNumber}
                            </div>
                          )}
                        </div>
                        <div
                          className="text-xs mt-1 line-clamp-2"
                          style={{ color: 'var(--foreground-muted)' }}
                        >
                          {result.excerpt}
                        </div>
                      </button>
                    ))
                  ) : searchQuery.length >= 3 ? (
                    <div className="px-4 py-8 text-center">
                      <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                        No results found
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>

          {/* Settings Menu (Apple Books style) */}
          <div className="relative" ref={settingsMenuRef}>
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
              className="absolute top-full right-0 mt-2 w-64 backdrop-blur-lg rounded-lg"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(45, 42, 38, 0.15)', overflow: 'visible' }}
            >
              {/* Theme Section - Dropdown */}
              <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {effectiveTheme === 'dark' ? (
                      <Moon className="w-4 h-4" style={{ color: 'var(--foreground-muted)' }} />
                    ) : (
                      <Sun className="w-4 h-4" style={{ color: 'var(--foreground-muted)' }} />
                    )}
                    <span className="text-sm" style={{ color: 'var(--foreground)' }}>Theme</span>
                  </div>
                  <select
                    value={theme}
                    onChange={(e) => setTheme(e.target.value as 'auto' | 'light' | 'dark')}
                    className="text-sm px-2 py-1 rounded-md cursor-pointer outline-none"
                    style={{
                      background: 'var(--background)',
                      color: 'var(--foreground)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <option value="auto">Auto</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </div>
              </div>

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

              {/* Font Section - Dropdown */}
              <div className="px-4 py-3 relative" style={{ borderBottom: '1px solid var(--border-subtle)', overflow: 'visible' }}>
                <button
                  onClick={() => setShowFontDropdown(!showFontDropdown)}
                  className="w-full flex items-center justify-between py-1 transition-colors"
                  style={{ color: 'var(--foreground)' }}
                >
                  <div className="flex items-center gap-2">
                    <Type className="w-4 h-4" style={{ color: 'var(--foreground-muted)' }} />
                    <span className="text-sm">Font</span>
                  </div>
                  <span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                    {FONT_OPTIONS.find(f => f.value === selectedFont)?.name || 'Charter'}
                  </span>
                </button>

                {/* Font Dropdown */}
                {showFontDropdown && (
                  <div
                    className="absolute left-0 right-0 top-full mt-1 mx-2 rounded-lg overflow-hidden z-10"
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      boxShadow: '0 4px 16px rgba(45, 42, 38, 0.15)',
                    }}
                  >
                    {FONT_OPTIONS.map((font) => (
                      <button
                        key={font.name}
                        onClick={() => {
                          handleFontChange(font.value);
                          setShowFontDropdown(false);
                        }}
                        className="w-full px-3 py-2 text-left text-sm transition-colors"
                        style={{
                          background: selectedFont === font.value ? 'var(--accent-subtle)' : 'transparent',
                          color: selectedFont === font.value ? 'var(--accent)' : 'var(--foreground)',
                          fontFamily: font.value,
                        }}
                        onMouseEnter={(e) => {
                          if (selectedFont !== font.value) {
                            e.currentTarget.style.background = 'var(--background-muted)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (selectedFont !== font.value) {
                            e.currentTarget.style.background = 'transparent';
                          }
                        }}
                      >
                        {font.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Size Section - Apple Books style A/A with progress dots */}
              <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: 'var(--foreground)' }}>Size</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={decreaseFontSize}
                      disabled={selectedFontSize === FONT_SIZE_OPTIONS[0].value}
                      className="w-9 h-9 flex items-center justify-center rounded-lg transition-all hover:scale-105 disabled:cursor-not-allowed disabled:hover:scale-100"
                      style={{
                        background: 'var(--background)',
                        border: '1px solid var(--border)',
                        color: selectedFontSize === FONT_SIZE_OPTIONS[0].value ? 'var(--foreground-subtle)' : 'var(--foreground)',
                        fontFamily: 'Charter, Georgia, serif',
                        fontSize: '12px',
                        fontWeight: 500,
                      }}
                    >
                      A
                    </button>
                    <button
                      onClick={increaseFontSize}
                      disabled={selectedFontSize === FONT_SIZE_OPTIONS[FONT_SIZE_OPTIONS.length - 1].value}
                      className="w-9 h-9 flex items-center justify-center rounded-lg transition-all hover:scale-105 disabled:cursor-not-allowed disabled:hover:scale-100"
                      style={{
                        background: 'var(--background)',
                        border: '1px solid var(--border)',
                        color: selectedFontSize === FONT_SIZE_OPTIONS[FONT_SIZE_OPTIONS.length - 1].value ? 'var(--foreground-subtle)' : 'var(--foreground)',
                        fontFamily: 'Charter, Georgia, serif',
                        fontSize: '20px',
                        fontWeight: 500,
                      }}
                    >
                      A
                    </button>
                  </div>
                </div>
                {/* Progress dots - appear briefly when changing size */}
                <div
                  className="flex items-center justify-center gap-1.5 mt-3 transition-opacity duration-300"
                  style={{ opacity: showSizeDots ? 1 : 0 }}
                >
                  {FONT_SIZE_OPTIONS.map((_, index) => {
                    const currentIndex = FONT_SIZE_OPTIONS.findIndex(opt => opt.value === selectedFontSize);
                    const isFilled = index <= currentIndex;
                    return (
                      <div
                        key={index}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          background: isFilled ? 'var(--foreground)' : 'var(--foreground-subtle)',
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Spacing Section - Slider */}
              <div className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <AlignJustify className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--foreground-muted)' }} />
                  <input
                    type="range"
                    min="1.2"
                    max="2.2"
                    step="0.1"
                    value={selectedLineSpacing}
                    onChange={(e) => handleLineSpacingChange(e.target.value)}
                    className="flex-1 h-1 rounded-full appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${((parseFloat(selectedLineSpacing) - 1.2) / 1.0) * 100}%, var(--border) ${((parseFloat(selectedLineSpacing) - 1.2) / 1.0) * 100}%, var(--border) 100%)`,
                    }}
                  />
                </div>
              </div>

              {/* Slider thumb styles */}
              <style>{`
                input[type="range"]::-webkit-slider-thumb {
                  -webkit-appearance: none;
                  appearance: none;
                  width: 16px;
                  height: 16px;
                  border-radius: 50%;
                  background: var(--accent);
                  cursor: pointer;
                  box-shadow: 0 2px 4px rgba(45, 42, 38, 0.2);
                }
                input[type="range"]::-moz-range-thumb {
                  width: 16px;
                  height: 16px;
                  border-radius: 50%;
                  background: var(--accent);
                  cursor: pointer;
                  border: none;
                  box-shadow: 0 2px 4px rgba(45, 42, 38, 0.2);
                }
              `}</style>
            </div>
          )}
          </div>
        </div>
      </header>

      <div
        className="flex-1 relative"
        onClick={() => {
          if (showSettingsMenu) setShowSettingsMenu(false);
          if (showSearchPanel) setShowSearchPanel(false);
          if (showFontDropdown) setShowFontDropdown(false);
        }}
      >
        <div
          className="absolute inset-0 overflow-hidden"
          style={{
            padding: '48px 24px',
            background: 'var(--surface)',
          }}
        >
          {/* The epub content with simple fade transition */}
          <div
            ref={viewerRef}
            className="w-full h-full"
            style={{
              opacity: isTransitioning ? 0 : 1,
              transition: `opacity ${FADE_DURATION}ms ease-out`,
            }}
          />
        </div>
        
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
        onClose={() => {
          setShowChapterNav(false);
          containerRef.current?.focus();
        }}
        isOpen={showChapterNav}
        pageNumbers={pageNumbers}
      />
    </div>
  );
}