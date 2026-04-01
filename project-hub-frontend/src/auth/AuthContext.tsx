import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { GroupMember } from '../types';
import { loginMember } from '../api/client';

const STORAGE_KEY = 'projecthub_user';

type AuthContextType = {
  user: GroupMember | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<GroupMember | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) setUser(JSON.parse(raw) as GroupMember);
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const m = await loginMember(username, password);
    if (!m) return false;
    setUser(m);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(m));
    return true;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
