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

  const simplifyText = async () => {
    setLoading(true);
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
        <h3 className="font-semibold text-sm text-gray-700">Selected Text</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mb-3 p-3 bg-gray-50 rounded text-sm text-gray-600 max-h-32 overflow-y-auto flex-shrink-0">
        {text}
      </div>

      <div className="border-t pt-3 flex-1 overflow-hidden flex flex-col min-h-0">
        <h4 className="font-semibold text-sm text-gray-700 mb-2 flex-shrink-0">Simplified</h4>
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