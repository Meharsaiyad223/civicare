import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, setAuthToken } from '../services/api.js';

const AuthContext = createContext(null);
const TOKEN_KEY = 'civiccare.token';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }
    setAuthToken(token);
    api.me().then(({ user: currentUser }) => setUser(currentUser))
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setAuthToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    async signIn(credentials) {
      const result = await api.login(credentials);
      localStorage.setItem(TOKEN_KEY, result.token);
      setAuthToken(result.token);
      setUser(result.user);
      return result.user;
    },
    async signUp(details) {
      const result = await api.register(details);
      localStorage.setItem(TOKEN_KEY, result.token);
      setAuthToken(result.token);
      setUser(result.user);
      return result.user;
    },
    signOut() {
      localStorage.removeItem(TOKEN_KEY);
      setAuthToken(null);
      setUser(null);
    },
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}
