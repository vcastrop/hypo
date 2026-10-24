import React, { createContext, useContext, useState } from 'react';

export interface User {
  username: string;
  role: string;
  cluster: string;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, role?: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('hypo_user');
    return saved ? JSON.parse(saved) : null;
  });

  const login = (username: string, role = 'Chaos Engineer') => {
    const userData: User = {
      username: username || 'engineer@hypo.local',
      role,
      cluster: 'kind-mybookstore',
    };
    setUser(userData);
    localStorage.setItem('hypo_user', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('hypo_user');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
