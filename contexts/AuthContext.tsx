'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface User {
  email: string;
  name: string;
  picture?: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Decode JWT payload (without verification - verification happens on server)
function decodeToken(token: string): User | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

    // Check expiration
    if (payload.exp && payload.exp < Date.now() / 1000) {
      return null;
    }

    return {
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    };
  } catch {
    return null;
  }
}

// Storage key for web (localStorage)
const TOKEN_STORAGE_KEY = 'auth_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load token on mount
  useEffect(() => {
    async function loadToken() {
      try {
        let storedToken: string | null = null;

        if (typeof window !== 'undefined') {
          if (window.electronAPI?.auth) {
            // Electron: load from secure storage
            storedToken = await window.electronAPI.auth.getToken();
          } else {
            // Web: load from localStorage
            storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
          }
        }

        if (storedToken) {
          const decodedUser = decodeToken(storedToken);
          if (decodedUser) {
            setToken(storedToken);
            setUser(decodedUser);
          } else {
            // Token expired or invalid, clear it
            if (window.electronAPI?.auth) {
              await window.electronAPI.auth.clearToken();
            } else {
              localStorage.removeItem(TOKEN_STORAGE_KEY);
            }
          }
        }
      } catch (error) {
        console.error('Error loading auth token:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadToken();

    // Listen for auth success from Electron (OAuth callback via custom protocol)
    if (typeof window !== 'undefined' && window.electronAPI?.auth) {
      window.electronAPI.auth.onAuthSuccess((newToken) => {
        const decodedUser = decodeToken(newToken);
        if (decodedUser) {
          setToken(newToken);
          setUser(decodedUser);
        }
      });
    }
  }, []);

  const login = useCallback(async () => {
    if (typeof window !== 'undefined') {
      if (window.electronAPI?.auth) {
        // Electron: open system browser for OAuth
        await window.electronAPI.auth.openLogin();
      } else {
        // Web: redirect to login endpoint
        window.location.href = '/api/auth/login';
      }
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      if (typeof window !== 'undefined') {
        if (window.electronAPI?.auth) {
          await window.electronAPI.auth.clearToken();
        } else {
          localStorage.removeItem(TOKEN_STORAGE_KEY);
        }
      }
      setToken(null);
      setUser(null);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user && !!token,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
