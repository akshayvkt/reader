'use client';

import dynamic from 'next/dynamic';
import { BookReaderProps } from './BookReader';
import { PDFReaderProps } from './PDFReader';

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

// Dynamically import PDFReader with no SSR
const PDFReader = dynamic(
  () => import('./PDFReader'),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading PDF reader...</div>
      </div>
    )
  }
);

// Detect file type from ArrayBuffer
function isPDF(data: ArrayBuffer): boolean {
  const view = new Uint8Array(data.slice(0, 4));
  // Check for PDF magic bytes: %PDF (0x25 0x50 0x44 0x46)
  return view[0] === 0x25 && view[1] === 0x50 &&
         view[2] === 0x44 && view[3] === 0x46;
}

type ReaderProps = BookReaderProps | PDFReaderProps;

export default function BookReaderWrapper(props: ReaderProps) {
  const fileType = isPDF(props.bookData) ? 'pdf' : 'epub';

  if (fileType === 'pdf') {
    return <PDFReader {...props as PDFReaderProps} />;
  }

  return <BookReader {...props as BookReaderProps} />;
}

export type { BookReaderProps };