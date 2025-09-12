'use client';

import { useState, useCallback } from 'react';
import { BookOpen } from 'lucide-react';
import BookReaderWrapper from '@/components/BookReaderWrapper';

export default function Home() {
  const [bookData, setBookData] = useState<ArrayBuffer | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileUpload = useCallback(async (file: File) => {
    if (file.type !== 'application/epub+zip' && !file.name.endsWith('.epub')) {
      alert('Please upload an EPUB file');
      return;
    }

    const arrayBuffer = await file.arrayBuffer();
    setBookData(arrayBuffer);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  if (bookData) {
    return <BookReaderWrapper bookData={bookData} onClose={() => setBookData(null)} />;
  }

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`
            relative rounded-3xl p-20 text-center
            transition-all duration-300 ease-out cursor-pointer
            ${isDragging 
              ? 'bg-white shadow-2xl scale-[1.02]' 
              : 'bg-white shadow-md hover:shadow-xl'
            }
          `}
        >
          <input
            type="file"
            accept=".epub,application/epub+zip"
            onChange={handleFileSelect}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />

          <div className="flex flex-col items-center gap-6">
            <BookOpen className={`
              w-12 h-12 transition-all duration-300
              ${isDragging ? 'text-gray-900 scale-110' : 'text-gray-400'}
            `} />
            
            <div className="text-center">
              <p className="text-xl text-gray-800 mb-1" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                Add your book
              </p>
              <p className="text-sm text-gray-400" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                EPUB files only
              </p>
            </div>
          </div>
        </div>

        {/* Minimal branding */}
        <div className="mt-12 text-center">
          <h1 className="text-xs font-medium text-gray-400 tracking-wider uppercase" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
            Reader
          </h1>
        </div>
      </div>
    </div>
  );
}