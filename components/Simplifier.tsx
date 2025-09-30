'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, Lightbulb, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface SimplifierProps {
  text: string;
  position: { x: number; y: number };
  onClose: () => void;
}

export default function Simplifier({ text, position, onClose }: SimplifierProps) {
  const [simplified, setSimplified] = useState('');
  const [loading, setLoading] = useState(false);
  const [popupStyle, setPopupStyle] = useState<{ left: string; top: string }>({ left: '0px', top: '0px' });
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    // Use a slight delay to avoid closing immediately on text selection
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }, 100);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Smart positioning - position at selection, keep within viewport bounds
  useEffect(() => {
    if (!popupRef.current) return;

    const popup = popupRef.current;
    const rect = popup.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    let x = position.x;
    let y = position.y + 8; // 8px below selection by default

    // If would go off bottom of screen, show above selection instead
    if (y + rect.height > viewportHeight - 20) {
      y = position.y - rect.height - 8;
    }

    // If would go off right edge, shift left
    if (x + rect.width > viewportWidth - 20) {
      x = viewportWidth - rect.width - 20;
    }

    // Never go off left edge
    x = Math.max(20, x);

    setPopupStyle({ left: `${x}px`, top: `${y}px` });
  }, [position, simplified, loading]); // Recalculate when content changes

  const fetchDictionaryDefinition = async (word: string) => {
    try {
      const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`);
      if (!response.ok) throw new Error('Word not found');
      
      const data = await response.json();
      const meanings = data[0]?.meanings || [];
      
      // Format the definition nicely
      const definitions = meanings.slice(0, 2).map((m: { partOfSpeech: string; definitions: Array<{ definition: string }> }) => 
        `${m.partOfSpeech}: ${m.definitions[0]?.definition}`
      ).join('; ');
      
      return definitions || 'No definition found';
    } catch {
      // Fall back to AI if dictionary fails
      return null;
    }
  };

  const simplifyText = useCallback(async (mode: 'explain' | 'eli5' = 'explain') => {
    setLoading(true);

    // For single words with "explain" mode, try dictionary first
    if (mode === 'explain' && text.split(' ').length === 1) {
      const dictDefinition = await fetchDictionaryDefinition(text);
      if (dictDefinition) {
        setSimplified(dictDefinition);
        setLoading(false);
        return;
      }
    }

    // Use AI for phrases or if dictionary fails
    try {
      const response = await fetch('/api/simplify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, mode }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error:', response.status, errorText);
        setSimplified('Failed to simplify text. Please try again.');
        return;
      }

      const data = await response.json();
      setSimplified(data.simplified || 'Unable to simplify text');
    } catch (error) {
      console.error('Failed to simplify text:', error);
      setSimplified('Failed to simplify text. Please try again.');
    }
    setLoading(false);
  }, [text]);


  return (
    <>
      {/* Invisible backdrop for click-to-close */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={popupRef}
        className="fixed z-50 bg-white/95 backdrop-blur-sm border border-gray-200/80 rounded-lg shadow-lg py-1.5"
        style={popupStyle}
      >
      {!simplified && !loading ? (
        <>
          <button
            onClick={() => simplifyText('explain')}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors duration-150 text-left whitespace-nowrap group"
          >
            <Lightbulb className="w-4 h-4 text-blue-500 group-hover:text-blue-600" />
            <span>Explain</span>
          </button>
          <button
            onClick={() => simplifyText('eli5')}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition-colors duration-150 text-left whitespace-nowrap group"
          >
            <Sparkles className="w-4 h-4 text-purple-500 group-hover:text-purple-600" />
            <span>ELI5</span>
          </button>
        </>
      ) : loading ? (
        <div className="flex items-center gap-2.5 px-4 py-2.5 min-w-[140px]">
          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
          <span className="text-sm font-medium text-gray-600">Loading...</span>
        </div>
      ) : (
        <div className="text-gray-800 text-sm leading-relaxed overflow-y-auto max-h-[400px] max-w-md px-3 py-2">
          <ReactMarkdown
            components={{
              strong: ({ children }) => <strong className="font-medium">{children}</strong>,
              em: ({ children }) => <em className="italic">{children}</em>,
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
            }}
          >
            {simplified}
          </ReactMarkdown>
        </div>
      )}
    </div>
    </>
  );
}