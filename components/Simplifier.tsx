'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Loader2 } from 'lucide-react';

interface SimplifierProps {
  text: string;
  position: { x: number; y: number };
  onClose: () => void;
}

export default function Simplifier({ text, position, onClose }: SimplifierProps) {
  const [simplified, setSimplified] = useState('');
  const [loading, setLoading] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const fetchDictionaryDefinition = async (word: string) => {
    try {
      const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`);
      if (!response.ok) throw new Error('Word not found');
      
      const data = await response.json();
      const meanings = data[0]?.meanings || [];
      
      // Format the definition nicely
      const definitions = meanings.slice(0, 2).map((m: any) => 
        `${m.partOfSpeech}: ${m.definitions[0]?.definition}`
      ).join('; ');
      
      return definitions || 'No definition found';
    } catch (error) {
      // Fall back to AI if dictionary fails
      return null;
    }
  };

  const simplifyText = async () => {
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
  };

  useEffect(() => {
    // Always use AI for simplification, whether single word or phrase
    simplifyText();
  }, [text]);

  return (
    <div
      ref={popupRef}
      className="fixed right-4 top-1/2 -translate-y-1/2 z-50 bg-white rounded-xl shadow-2xl border p-5 max-w-md w-96 max-h-[80vh] overflow-hidden flex flex-col animate-in slide-in-from-right duration-200"
    >
      <div className="flex items-start justify-between mb-3">
        {/* <h3 className="font-semibold text-sm text-gray-700">Selected Text</h3> */}
        <div /> {/* Empty div to maintain flex layout */}
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Commented out selected text display
      <div className="mb-3 p-3 bg-gray-50 rounded text-sm text-gray-600 max-h-32 overflow-y-auto flex-shrink-0">
        {text}
      </div>
      */}

      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {/* <h4 className="font-semibold text-sm text-gray-700 mb-2 flex-shrink-0">Simplified</h4> */}
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="text-sm text-gray-800 leading-relaxed overflow-y-auto flex-1 pr-2">
            {simplified || 'Simplifying...'}
          </div>
        )}
      </div>
    </div>
  );
}