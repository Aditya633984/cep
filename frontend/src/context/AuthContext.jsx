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
      return stored ? JSON.parse(stored) : null;
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

  /**
   * Call after a successful login/register API response.
   */
  const login = useCallback((newToken, newUser) => {
    setToken(newToken);
    setUser(newUser);
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
