'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { TextLayer } from 'pdfjs-dist';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw, Maximize2, Minimize2 } from 'lucide-react';
import Simplifier from './Simplifier';
import '../app/pdf-viewer.css';

// Set worker path
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

export interface PDFReaderProps {
  bookData: ArrayBuffer;
  onClose: () => void;
}

export default function PDFReader({ bookData, onClose }: PDFReaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);

  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [selectionPosition, setSelectionPosition] = useState({ x: 0, y: 0 });
  const [showSimplifier, setShowSimplifier] = useState(false);
  const selectionTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Custom selection state and refs
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; span: HTMLElement | null } | null>(null);
  const spanCacheRef = useRef<Map<HTMLElement, DOMRect>>(new Map());
  const highlightedSpansRef = useRef<Set<HTMLElement>>(new Set());
  const animationFrameRef = useRef<number | null>(null);

  // Focus container on mount to enable keyboard shortcuts
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  // Load PDF
  useEffect(() => {
    if (!bookData) return;

    const loadPdf = async () => {
      try {
        const loadingTask = pdfjsLib.getDocument({ data: bookData });
        const pdfDocument = await loadingTask.promise;
        setPdf(pdfDocument);
        setTotalPages(pdfDocument.numPages);

        // Load saved page position
        const savedPage = localStorage.getItem(`pdf-page-${bookData.byteLength}`);
        if (savedPage) {
          setCurrentPage(parseInt(savedPage, 10));
        }
      } catch (error) {
        console.error('Error loading PDF:', error);
      }
    };

    loadPdf();
  }, [bookData]);

  // Render page
  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdf || !canvasRef.current || !textLayerRef.current) return;

    try {
      const page = await pdf.getPage(pageNum);

      // Get device pixel ratio for high-DPI displays (Retina, etc.)
      const dpr = window.devicePixelRatio || 1;

      // Create high-resolution viewport for canvas rendering
      const canvasViewport = page.getViewport({ scale: scale * dpr });

      // Create separate viewport for text layer (at logical pixel size)
      const textLayerViewport = page.getViewport({ scale });

      // Set canvas dimensions to full pixel resolution
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;

      canvas.width = canvasViewport.width;
      canvas.height = canvasViewport.height;

      // Scale canvas back to logical size with CSS
      canvas.style.width = `${canvasViewport.width / dpr}px`;
      canvas.style.height = `${canvasViewport.height / dpr}px`;

      // Render PDF page at high resolution
      const renderContext = {
        canvasContext: context,
        viewport: canvasViewport,
      };
      await page.render(renderContext).promise;

      // Clear previous text layer
      textLayerRef.current.innerHTML = '';
      // Text layer uses logical pixel dimensions to align with visual canvas size
      textLayerRef.current.style.width = `${textLayerViewport.width}px`;
      textLayerRef.current.style.height = `${textLayerViewport.height}px`;

      // Render text layer for selection
      const textContent = await page.getTextContent();
      const textLayerDiv = textLayerRef.current;

      // Create text layer using logical viewport
      const textLayer = new TextLayer({
        textContentSource: textContent,
        container: textLayerDiv,
        viewport: textLayerViewport,
      });

      // Render the text layer
      await textLayer.render();

      // Cache span positions for custom selection
      cacheSpanPositions();

      // Save page position
      localStorage.setItem(`pdf-page-${bookData.byteLength}`, pageNum.toString());
    } catch (error) {
      console.error('Error rendering page:', error);
    }
  }, [pdf, scale, bookData.byteLength]);

  // Re-render when page or scale changes
  useEffect(() => {
    if (pdf) {
      renderPage(currentPage);
    }
  }, [currentPage, pdf, renderPage]);

  // Navigation functions
  const nextPage = useCallback(() => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
      containerRef.current?.focus();
    }
  }, [currentPage, totalPages]);

  const prevPage = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
      containerRef.current?.focus();
    }
  }, [currentPage]);

  // Zoom functions
  const zoomIn = useCallback(() => {
    setScale(prev => Math.min(prev + 0.25, 3));
  }, []);

  const zoomOut = useCallback(() => {
    setScale(prev => Math.max(prev - 0.25, 0.5));
  }, []);

  const resetZoom = useCallback(() => {
    setScale(1.5);
  }, []);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  // Custom selection helper functions
  const cacheSpanPositions = useCallback(() => {
    if (!textLayerRef.current) return;

    spanCacheRef.current.clear();
    const spans = textLayerRef.current.querySelectorAll('span:not(.endOfContent)');

    spans.forEach((span) => {
      const htmlSpan = span as HTMLElement;
      const rect = htmlSpan.getBoundingClientRect();
      spanCacheRef.current.set(htmlSpan, rect);
    });
  }, []);

  const clearHighlights = useCallback(() => {
    highlightedSpansRef.current.forEach(span => {
      span.classList.remove('pdf-text-highlighted');
    });
    highlightedSpansRef.current.clear();
  }, []);

  const applyHighlights = useCallback((spans: Set<HTMLElement>) => {
    spans.forEach(span => {
      span.classList.add('pdf-text-highlighted');
    });
  }, []);

  // Custom selection: Mouse down handler
  const handleTextMouseDown = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.matches('.textLayer span')) return;

    e.preventDefault();

    // Clear any existing selection
    window.getSelection()?.removeAllRanges();
    clearHighlights();
    setShowSimplifier(false);

    // Start drag tracking
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      span: target as HTMLElement
    };
  }, [clearHighlights]);

  // Custom selection: Mouse move handler with geometric filtering
  const handleTextMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !dragStartRef.current || !textLayerRef.current) return;

    // Cancel any pending animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // Use requestAnimationFrame for smooth performance
    animationFrameRef.current = requestAnimationFrame(() => {
      const startX = dragStartRef.current!.x;
      const startY = dragStartRef.current!.y;
      const currentX = e.clientX;
      const currentY = e.clientY;

      // Calculate drag corridor bounds
      const minX = Math.min(startX, currentX);
      const maxX = Math.max(startX, currentX);
      const minY = Math.min(startY, currentY);
      const maxY = Math.max(startY, currentY);

      // Find all spans that intersect with drag corridor
      const validSpans: Array<{element: HTMLElement, rect: DOMRect}> = [];

      spanCacheRef.current.forEach((rect, span) => {
        // Check if span intersects with drag rectangle
        const intersects = (
          rect.left < maxX &&
          rect.right > minX &&
          rect.top < maxY &&
          rect.bottom > minY
        );

        if (intersects) {
          validSpans.push({ element: span, rect });
        }
      });

      if (validSpans.length === 0) return;

      // Sort spans by visual position (top to bottom, left to right)
      validSpans.sort((a, b) => {
        const yDiff = a.rect.top - b.rect.top;
        if (Math.abs(yDiff) < 5) { // Same line
          return a.rect.left - b.rect.left;
        }
        return yDiff;
      });

      // Calculate typical line height
      const heights = validSpans.slice(0, Math.min(3, validSpans.length)).map(sp => sp.rect.height);
      const lineHeight = Math.max(...heights, 20);

      // Filter out spans that "jumped" to non-contiguous lines
      const continuousSpans: HTMLElement[] = [];

      for (let i = 0; i < validSpans.length; i++) {
        const current = validSpans[i];

        if (i === 0) {
          continuousSpans.push(current.element);
          continue;
        }

        const previous = validSpans[i - 1];
        const verticalGap = current.rect.top - previous.rect.bottom;

        // If gap is too large, stop including spans
        if (verticalGap > lineHeight * 1.5) {
          break;
        }

        continuousSpans.push(current.element);
      }

      // Update highlights
      clearHighlights();
      const newHighlightedSpans = new Set(continuousSpans);
      highlightedSpansRef.current = newHighlightedSpans;
      applyHighlights(newHighlightedSpans);
    });
  }, [isDragging, clearHighlights, applyHighlights]);

  // Custom selection: Mouse up handler to finalize selection
  const handleTextMouseUp = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    setIsDragging(false);

    // Cancel any pending animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (highlightedSpansRef.current.size === 0) {
      dragStartRef.current = null;
      return;
    }

    // Build selection from highlighted spans
    const spans = Array.from(highlightedSpansRef.current);

    // Sort by visual position
    const sortedSpans = spans.map(span => ({
      element: span,
      rect: span.getBoundingClientRect()
    })).sort((a, b) => {
      const yDiff = a.rect.top - b.rect.top;
      if (Math.abs(yDiff) < 5) {
        return a.rect.left - b.rect.left;
      }
      return yDiff;
    }).map(item => item.element);

    if (sortedSpans.length > 0) {
      try {
        // Create range from first to last span
        const range = document.createRange();
        const firstSpan = sortedSpans[0];
        const lastSpan = sortedSpans[sortedSpans.length - 1];

        // Set range boundaries
        if (firstSpan.firstChild) {
          range.setStartBefore(firstSpan.firstChild);
        } else {
          range.setStartBefore(firstSpan);
        }

        if (lastSpan.lastChild) {
          range.setEndAfter(lastSpan.lastChild);
        } else {
          range.setEndAfter(lastSpan);
        }

        // Apply selection
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(range);

          // Extract text and show simplifier
          const text = selection.toString().trim();
          if (text) {
            const rect = range.getBoundingClientRect();
            setSelectedText(text);
            setSelectionPosition({
              x: rect.left + rect.width / 2,
              y: rect.top
            });
            setShowSimplifier(true);
          }
        }
      } catch (error) {
        console.error('Error creating selection:', error);
      }
    }

    // Clear highlights after selection is made
    clearHighlights();
    dragStartRef.current = null;
  }, [isDragging, clearHighlights]);

  // Custom text selection with geometry-based mouse tracking
  useEffect(() => {
    const textLayer = textLayerRef.current;
    if (!textLayer) return;

    // Attach mouse event listeners
    textLayer.addEventListener('mousedown', handleTextMouseDown as EventListener);
    document.addEventListener('mousemove', handleTextMouseMove as EventListener);
    document.addEventListener('mouseup', handleTextMouseUp as EventListener);

    // Apply dragging class when dragging
    if (isDragging) {
      textLayer.classList.add('dragging');
    } else {
      textLayer.classList.remove('dragging');
    }

    return () => {
      textLayer.removeEventListener('mousedown', handleTextMouseDown as EventListener);
      document.removeEventListener('mousemove', handleTextMouseMove as EventListener);
      document.removeEventListener('mouseup', handleTextMouseUp as EventListener);

      // Cleanup animation frame on unmount
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [handleTextMouseDown, handleTextMouseMove, handleTextMouseUp, isDragging]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Skip if user is typing in an input or textarea
    const target = e.target as HTMLElement;
    if (target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement) {
      return;
    }

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      nextPage();
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      prevPage();
    }
    if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      toggleFullscreen();
    }
    if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      zoomIn();
    }
    if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      zoomOut();
    }
    if (e.key === '0') {
      e.preventDefault();
      resetZoom();
    }
    if (e.key === 'Escape') {
      setShowSimplifier(false);
    }
  }, [nextPage, prevPage, toggleFullscreen, zoomIn, zoomOut, resetZoom]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      // Refocus container after fullscreen change
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
      className="fixed inset-0 bg-gray-50 flex flex-col outline-none"
      tabIndex={0}
      autoFocus
    >
      {/* Header with controls */}
      <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-white/90 to-transparent transition-opacity hover:opacity-100 opacity-0">
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 bg-white/80 backdrop-blur rounded-lg"
        >
          ← Back to Library
        </button>

        <div className="flex items-center gap-4">
          {/* Page indicator */}
          <span className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-white/80 backdrop-blur rounded-lg">
            Page {currentPage} of {totalPages}
          </span>

          <div className="w-px h-6 bg-gray-300/50" />

          {/* Zoom controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={zoomOut}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 bg-white/80 backdrop-blur rounded-lg flex items-center gap-2"
              aria-label="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>

            <button
              onClick={resetZoom}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 bg-white/80 backdrop-blur rounded-lg flex items-center gap-2"
              aria-label="Reset zoom"
            >
              <RotateCw className="w-4 h-4" />
              <span className="text-xs">{Math.round(scale * 100)}%</span>
            </button>

            <button
              onClick={zoomIn}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 bg-white/80 backdrop-blur rounded-lg flex items-center gap-2"
              aria-label="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          <div className="w-px h-6 bg-gray-300/50" />

          {/* Fullscreen toggle */}
          <button
            onClick={toggleFullscreen}
            className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 bg-white/80 backdrop-blur rounded-lg flex items-center gap-2"
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
        </div>
      </header>

      {/* PDF content */}
      <div className="flex-1 relative overflow-auto flex items-center justify-center">
        <div className="pdf-page-container relative">
          <canvas ref={canvasRef} className="pdf-canvas" />
          <div ref={textLayerRef} className="textLayer" />
        </div>

        {/* Navigation buttons */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4 z-10">
          <button
            onClick={prevPage}
            disabled={currentPage <= 1}
            className="p-2 rounded-full bg-white/90 hover:bg-white shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-5 h-5 text-gray-700" />
          </button>

          <button
            onClick={nextPage}
            disabled={currentPage >= totalPages}
            className="p-2 rounded-full bg-white/90 hover:bg-white shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Next page"
          >
            <ChevronRight className="w-5 h-5 text-gray-700" />
          </button>
        </div>
      </div>

      {/* Simplifier popup */}
      {showSimplifier && (
        <Simplifier
          text={selectedText}
          position={selectionPosition}
          onClose={() => {
            setShowSimplifier(false);
            // Clear text selection
            const selection = window.getSelection();
            if (selection) {
              selection.removeAllRanges();
            }
          }}
        />
      )}
    </div>
  );
}