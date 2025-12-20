'use client';

import dynamic from 'next/dynamic';
import { ChatProvider } from '../contexts/ChatContext';
import ReaderLayout from './ReaderLayout';

// Shared props for both readers
export interface ReaderProps {
  bookData: ArrayBuffer;
  filePath?: string;
  onClose: () => void;
}

// Loading component with warm styling
const LoadingSpinner = ({ message }: { message: string }) => (
  <div
    className="fixed inset-0 flex items-center justify-center"
    style={{ background: 'var(--background)' }}
  >
    <div style={{ color: 'var(--foreground-muted)' }}>{message}</div>
  </div>
);

// Dynamically import BookReader with no SSR
const BookReader = dynamic(
  () => import('./BookReader'),
  {
    ssr: false,
    loading: () => <LoadingSpinner message="Loading reader..." />
  }
);

// Dynamically import PDFReader with no SSR
const PDFReader = dynamic(
  () => import('./PDFReader'),
  {
    ssr: false,
    loading: () => <LoadingSpinner message="Loading PDF reader..." />
  }
);

// Detect file type from ArrayBuffer
function isPDF(data: ArrayBuffer): boolean {
  const view = new Uint8Array(data.slice(0, 4));
  // Check for PDF magic bytes: %PDF (0x25 0x50 0x44 0x46)
  return view[0] === 0x25 && view[1] === 0x50 &&
         view[2] === 0x44 && view[3] === 0x46;
}

export default function BookReaderWrapper(props: ReaderProps) {
  const fileType = isPDF(props.bookData) ? 'pdf' : 'epub';

  return (
    <ChatProvider>
      <ReaderLayout>
        {fileType === 'pdf' ? (
          <PDFReader {...props} />
        ) : (
          <BookReader {...props} />
        )}
      </ReaderLayout>
    </ChatProvider>
  );
}