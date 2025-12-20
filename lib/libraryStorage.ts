import { RecentBook } from '../types/library';

const STORAGE_KEY = 'reader-recent-books';
const MAX_RECENT_BOOKS = 12;

export function getRecentBooks(): RecentBook[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as RecentBook[];
  } catch {
    return [];
  }
}

export function addRecentBook(book: RecentBook): void {
  if (typeof window === 'undefined') return;

  const books = getRecentBooks();

  // Remove existing entry for this book (if re-opening)
  const filtered = books.filter(b => b.id !== book.id);

  // Add to front of list
  filtered.unshift(book);

  // Limit to max recent books
  const trimmed = filtered.slice(0, MAX_RECENT_BOOKS);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

export function updateBookProgress(id: string, progress: number, cfi?: string): void {
  if (typeof window === 'undefined') return;

  const books = getRecentBooks();
  const bookIndex = books.findIndex(b => b.id === id);

  if (bookIndex !== -1) {
    books[bookIndex].progress = progress;
    books[bookIndex].lastOpened = Date.now();
    if (cfi) {
      books[bookIndex].currentCfi = cfi;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
  }
}

export function getBookById(id: string): RecentBook | undefined {
  const books = getRecentBooks();
  return books.find(b => b.id === id);
}
