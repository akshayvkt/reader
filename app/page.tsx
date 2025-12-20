'use client';

import { useState, useCallback } from 'react';
import { BookOpen } from 'lucide-react';
import BookReaderWrapper from '@/components/BookReaderWrapper';

export default function Home() {
  const [bookData, setBookData] = useState<ArrayBuffer | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileUpload = useCallback(async (file: File) => {
    const isEpub = file.type === 'application/epub+zip' || file.name.endsWith('.epub');
    const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');

    if (!isEpub && !isPdf) {
      alert('Please upload an EPUB or PDF file');
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
    <div className="min-h-screen flex items-center justify-center p-8" style={{ background: 'var(--background)' }}>
      <div className="w-full max-w-2xl">
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`
            relative rounded-3xl p-20 text-center
            transition-all duration-300 ease-out cursor-pointer
            ${isDragging
              ? 'scale-[1.02]'
              : 'hover:scale-[1.01]'
            }
          `}
          style={{
            background: 'var(--surface)',
            boxShadow: isDragging
              ? '0 20px 40px rgba(45, 42, 38, 0.15)'
              : '0 4px 20px rgba(45, 42, 38, 0.08)',
            border: '1px solid var(--border-subtle)'
          }}
        >
          <input
            type="file"
            accept=".epub,application/epub+zip,.pdf,application/pdf"
            onChange={handleFileSelect}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />

          <div className="flex flex-col items-center gap-6">
            <BookOpen
              className={`w-12 h-12 transition-all duration-300 ${isDragging ? 'scale-110' : ''}`}
              style={{ color: isDragging ? 'var(--accent)' : 'var(--foreground-subtle)' }}
            />

            <div className="text-center">
              <p
                className="text-xl mb-1"
                style={{ fontFamily: 'var(--font-libre-baskerville)', color: 'var(--foreground)' }}
              >
                Add your book
              </p>
              <p
                className="text-sm"
                style={{ color: 'var(--foreground-subtle)' }}
              >
                EPUB or PDF files
              </p>
            </div>
          </div>
        </div>

        {/* Minimal branding */}
        <div className="mt-12 text-center">
          <h1
            className="text-xs font-medium tracking-wider uppercase"
            style={{ fontFamily: 'var(--font-libre-baskerville)', color: 'var(--foreground-subtle)' }}
          >
            Reader
          </h1>
        </div>
      </div>
    </div>
  );
}