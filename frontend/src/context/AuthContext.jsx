import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { BASE_URL } from '../utils/api';

const AuthContext = createContext(null);

const STORAGE_KEY_TOKEN = 'fb_token';
const STORAGE_KEY_USER  = 'fb_user';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEY_TOKEN));
  const [user,  setUser]  = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_USER);
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      if (parsed && parsed.role) {
        parsed.role = String(parsed.role).trim().toLowerCase();
      }
      return parsed;
    } catch {
      return null;
    }
  });

  // Keep localStorage in sync whenever state changes
  useEffect(() => {
    if (token && user) {
      localStorage.setItem(STORAGE_KEY_TOKEN, token);
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY_TOKEN);
      localStorage.removeItem(STORAGE_KEY_USER);
    }
  }, [token, user]);

  // Synchronize across browser tabs and handle token expiration
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === STORAGE_KEY_TOKEN || e.key === STORAGE_KEY_USER) {
        const storedToken = localStorage.getItem(STORAGE_KEY_TOKEN);
        const storedUserRaw = localStorage.getItem(STORAGE_KEY_USER);
        let storedUser = null;
        try {
          storedUser = storedUserRaw ? JSON.parse(storedUserRaw) : null;
          if (storedUser && storedUser.role) {
            storedUser.role = String(storedUser.role).trim().toLowerCase();
          }
        } catch {
          storedUser = null;
        }
        setToken(storedToken);
        setUser(storedUser);
      }
    };

    const handleAuthExpired = (e) => {
      setToken(null);
      setUser(null);
      try {
        localStorage.removeItem(STORAGE_KEY_TOKEN);
        localStorage.removeItem(STORAGE_KEY_USER);
      } catch {}

      const msg = e?.detail?.message || 'Your session has expired. Please log in again.';
      try {
        sessionStorage.setItem('fb_session_expired', msg);
      } catch {}

      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.replace('/login?expired=1');
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('fb:auth-expired', handleAuthExpired);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('fb:auth-expired', handleAuthExpired);
    };
  }, []);

  /**
   * Call after a successful login/register API response.
   */
  const login = useCallback((newToken, newUser) => {
    const normalizedUser = newUser
      ? {
          ...newUser,
          role: newUser.role ? String(newUser.role).trim().toLowerCase() : newUser.role,
        }
      : null;
    setToken(newToken);
    setUser(normalizedUser);
  }, []);

  /**
   * Clear auth state + localStorage.
   */
  const logout = useCallback(async () => {
    try {
      // Notify the server (stateless logout always succeeds)
      await fetch(`${BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch {
      // Ignore network errors
    }
    setToken(null);
    setUser(null);
  }, [token]);

  const isAuthenticated = Boolean(token && user);

  return (
    <AuthContext.Provider value={{ token, user, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Custom hook – use inside any component that needs auth state.
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
