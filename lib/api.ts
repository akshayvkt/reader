// API URL helper - uses local in dev, Render in production
const PROD_API_URL = 'https://reader-g6kh.onrender.com';

export function getApiUrl(path: string): string {
  // In development (localhost), use relative path
  // In production (file:// or deployed), use Render URL
  const isDev = typeof window !== 'undefined' &&
    window.location.hostname === 'localhost';

  if (isDev) {
    return path; // e.g., '/api/simplify'
  }

  return `${PROD_API_URL}${path}`; // e.g., 'https://reader-g6kh.onrender.com/api/simplify'
}
