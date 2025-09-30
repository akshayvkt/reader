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
  const dragStartRef = useRef<{
    x: number;
    y: number;
    offsetNode: Node;
    offset: number
  } | null>(null);

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

  // Browser-native character-level selection using caretPositionFromPoint API
  const getCaretPosition = useCallback((x: number, y: number) => {
    // Firefox/modern browsers
    if (document.caretPositionFromPoint) {
      return document.caretPositionFromPoint(x, y);
    }
    // Chrome/Safari fallback
    else if ((document as any).caretRangeFromPoint) {
      const range = (document as any).caretRangeFromPoint(x, y);
      if (range) {
        return {
          offsetNode: range.startContainer,
          offset: range.startOffset
        };
      }
    }
    return null;
  }, []);

  // Mouse down handler - get precise character position at click
  const handleTextMouseDown = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement;

    // Only handle clicks on text layer or its children
    if (!textLayerRef.current?.contains(target)) return;

    // Clear any existing selection
    window.getSelection()?.removeAllRanges();
    setShowSimplifier(false);

    // Get precise caret position at mouse coordinates
    const caretPos = getCaretPosition(e.clientX, e.clientY);

    if (!caretPos || !caretPos.offsetNode) return;

    // Start drag tracking
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      offsetNode: caretPos.offsetNode,
      offset: caretPos.offset
    };
  }, [getCaretPosition]);

  // Mouse up handler - create precise selection from character positions
  const handleTextMouseUp = useCallback((e: MouseEvent) => {
    if (!isDragging || !dragStartRef.current) return;

    setIsDragging(false);

    // Get precise caret position at mouseup coordinates
    const endCaretPos = getCaretPosition(e.clientX, e.clientY);

    if (!endCaretPos || !endCaretPos.offsetNode) {
      dragStartRef.current = null;
      return;
    }

    const startNode = dragStartRef.current.offsetNode;
    const startOffset = dragStartRef.current.offset;
    const endNode = endCaretPos.offsetNode;
    const endOffset = endCaretPos.offset;

    try {
      // Create range with character-level precision
      const range = document.createRange();

      // Handle potential backwards selection
      const position = startNode.compareDocumentPosition(endNode);

      if (position === 0) {
        // Same node - compare offsets
        if (startOffset <= endOffset) {
          range.setStart(startNode, startOffset);
          range.setEnd(endNode, endOffset);
        } else {
          range.setStart(endNode, endOffset);
          range.setEnd(startNode, startOffset);
        }
      } else if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
        // endNode comes after startNode (normal forward selection)
        range.setStart(startNode, startOffset);
        range.setEnd(endNode, endOffset);
      } else {
        // endNode comes before startNode (backwards selection)
        range.setStart(endNode, endOffset);
        range.setEnd(startNode, startOffset);
      }

      // Apply the precise selection
      const selection = window.getSelection();
      if (selection && !range.collapsed) {
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
      console.error('Error creating selection range:', error);
    }

    dragStartRef.current = null;
  }, [isDragging, getCaretPosition]);

  // Browser-native text selection event listeners
  useEffect(() => {
    const textLayer = textLayerRef.current;
    if (!textLayer) return;

    // Prevent default text selection behavior during drag
    const preventDefaultSelection = (e: Event) => {
      if (isDragging) {
        e.preventDefault();
      }
    };

    textLayer.addEventListener('mousedown', handleTextMouseDown as EventListener);
    document.addEventListener('mouseup', handleTextMouseUp as EventListener);
    document.addEventListener('selectstart', preventDefaultSelection);

    return () => {
      textLayer.removeEventListener('mousedown', handleTextMouseDown as EventListener);
      document.removeEventListener('mouseup', handleTextMouseUp as EventListener);
      document.removeEventListener('selectstart', preventDefaultSelection);
    };
  }, [handleTextMouseDown, handleTextMouseUp, isDragging]);

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