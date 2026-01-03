// API URL helper - uses local in dev, Render in production
const PROD_API_URL = 'https://reader-g6kh.onrender.com';

// Storage key for web auth token
const TOKEN_STORAGE_KEY = 'auth_token';

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

// Get the auth token from storage
export async function getAuthToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  if (window.electronAPI?.auth) {
    // Electron: get from secure storage
    return await window.electronAPI.auth.getToken();
  } else {
    // Web: get from localStorage
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  }
}

// Get headers for authenticated API requests
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}
