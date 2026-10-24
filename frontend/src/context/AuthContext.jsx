import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

export const MOCK_USERS = {
  donor: {
    id: 2,
    name: 'Grand Plaza Hotel',
    email: 'donor@foodbridge.org',
    role: 'donor',
  },
  ngo: {
    id: 4,
    name: 'Feeding Hope Foundation',
    email: 'ngo@hope.org',
    role: 'ngo',
  },
  volunteer: {
    id: 7,
    name: 'Alex Courier',
    email: 'volunteer@foodbridge.org',
    role: 'volunteer',
  },
  admin: {
    id: 1,
    name: 'Platform Admin',
    email: 'admin@foodbridge.org',
    role: 'admin',
  },
};

const getRoleFromPath = () => {
  if (typeof window === 'undefined') return 'donor';
  const path = window.location.pathname.toLowerCase();
  if (path.startsWith('/ngo')) return 'ngo';
  if (path.startsWith('/volunteer')) return 'volunteer';
  if (path.startsWith('/admin')) return 'admin';
  return 'donor';
};

export function AuthProvider({ children }) {
  const [activeRole, setActiveRole] = useState(() => {
    return localStorage.getItem('fb_active_role') || getRoleFromPath();
  });

  const [customUser, setCustomUser] = useState(() => {
    try {
      const stored = localStorage.getItem('fb_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Automatically update role context if the user navigates to a role route
  useEffect(() => {
    const handleLocationChange = () => {
      const pathRole = getRoleFromPath();
      if (pathRole && pathRole !== activeRole && window.location.pathname !== '/') {
        setActiveRole(pathRole);
        localStorage.setItem('fb_active_role', pathRole);
      }
    };

    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, [activeRole]);

  const user = customUser || MOCK_USERS[activeRole] || MOCK_USERS.donor;
  const token = 'mock_jwt_token';
  const isAuthenticated = true;

  const login = useCallback((_newToken, newUser) => {
    if (newUser) {
      setCustomUser(newUser);
      if (newUser.role) {
        setActiveRole(newUser.role);
        localStorage.setItem('fb_active_role', newUser.role);
      }
      localStorage.setItem('fb_user', JSON.stringify(newUser));
    }
  }, []);

  const switchRole = useCallback((newRole) => {
    if (MOCK_USERS[newRole]) {
      setActiveRole(newRole);
      setCustomUser(MOCK_USERS[newRole]);
      localStorage.setItem('fb_active_role', newRole);
      localStorage.setItem('fb_user', JSON.stringify(MOCK_USERS[newRole]));
    }
  }, []);

  const logout = useCallback(async () => {
    // Stateless logout - maintains open platform access without locking out
    setCustomUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isAuthenticated,
        role: user.role,
        switchRole,
        login,
        logout,
        mockUsers: MOCK_USERS,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
