'use client';

import { useState, useCallback } from 'react';
import { Upload, BookOpen } from 'lucide-react';
import BookReader from '@/components/BookReader';

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
    return <BookReader bookData={bookData} onClose={() => setBookData(null)} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <BookOpen className="w-16 h-16 text-indigo-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Simple Reader
          </h1>
          <p className="text-lg text-gray-600">
            Read complex books with AI-powered simplification
          </p>
        </div>

        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`
            relative border-2 border-dashed rounded-xl p-12 text-center
            transition-all duration-200 ease-in-out
            ${isDragging 
              ? 'border-indigo-500 bg-indigo-50 scale-105' 
              : 'border-gray-300 bg-white hover:border-indigo-400 hover:bg-gray-50'
            }
          `}
        >
          <input
            type="file"
            accept=".epub,application/epub+zip"
            onChange={handleFileSelect}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />

          <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          
          <p className="text-lg font-medium text-gray-700 mb-2">
            Drop your EPUB file here
          </p>
          <p className="text-sm text-gray-500">
            or click to browse
          </p>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600">
            Select any confusing text while reading to get a simplified explanation
          </p>
        </div>
      </div>
    </div>
  );
}