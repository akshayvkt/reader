'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface SimplifierProps {
  text: string;
  position: { x: number; y: number };
  onClose: () => void;
}

export default function Simplifier({ text, onClose }: SimplifierProps) {
  const [simplified, setSimplified] = useState('');
  const [loading, setLoading] = useState(false);
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

  const simplifyText = useCallback(async () => {
    setLoading(true);
    
    // For single words, try dictionary first
    if (text.split(' ').length === 1) {
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
        body: JSON.stringify({ text }),
      });
      const data = await response.json();
      setSimplified(data.simplified);
    } catch (error) {
      console.error('Failed to simplify text:', error);
      setSimplified('Failed to simplify text. Please try again.');
    }
    setLoading(false);
  }, [text]);

  useEffect(() => {
    // Debounce API call by 200ms to wait for user to finish selecting
    const timer = setTimeout(() => {
      simplifyText();
    }, 200);

    return () => clearTimeout(timer);
  }, [text, simplifyText]);

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
        className="fixed right-8 top-1/2 -translate-y-1/2 z-50 bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-6 max-w-md w-96 max-h-[70vh] overflow-hidden flex flex-col animate-in slide-in-from-right duration-200"
      >

      {/* Commented out selected text display
      <div className="mb-3 p-3 bg-gray-50 rounded text-sm text-gray-600 max-h-32 overflow-y-auto flex-shrink-0">
        {text}
      </div>
      */}

      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
              <span className="text-xs text-gray-400">Understanding...</span>
            </div>
          </div>
        ) : (
          <div className="text-gray-700 leading-relaxed overflow-y-auto flex-1 text-[15px] font-light prose prose-sm max-w-none">
            <ReactMarkdown
              components={{
                strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                em: ({ children }) => <em className="italic">{children}</em>,
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              }}
            >
              {simplified || 'Simplifying...'}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
    </>
  );
}