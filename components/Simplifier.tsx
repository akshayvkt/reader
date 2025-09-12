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
    if (text.split(' ').length === 1) {
      setSimplified(`Definition: ${text} - [Would fetch dictionary definition here]`);
    } else {
      simplifyText();
    }
  }, [text]);

  const popupStyle = {
    left: `${Math.min(position.x, window.innerWidth - 400)}px`,
    top: `${Math.min(position.y + 20, window.innerHeight - 200)}px`,
  };

  return (
    <div
      ref={popupRef}
      className="fixed z-50 bg-white rounded-lg shadow-xl border p-4 max-w-md w-96"
      style={popupStyle}
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

      <div className="mb-3 p-2 bg-gray-50 rounded text-sm text-gray-600 max-h-20 overflow-y-auto">
        {text}
      </div>

      <div className="border-t pt-3">
        <h4 className="font-semibold text-sm text-gray-700 mb-2">Simplified</h4>
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="text-sm text-gray-800 leading-relaxed">
            {simplified || 'Simplifying...'}
          </div>
        )}
      </div>
    </div>
  );
}