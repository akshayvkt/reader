'use client';

import dynamic from 'next/dynamic';
import { BookReaderProps } from './BookReader';

// Dynamically import BookReader with no SSR
const BookReader = dynamic(
  () => import('./BookReader'),
  { 
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading reader...</div>
      </div>
    )
  }
);

export default function BookReaderWrapper(props: BookReaderProps) {
  return <BookReader {...props} />;
}

export type { BookReaderProps };