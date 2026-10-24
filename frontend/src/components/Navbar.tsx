import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, Radio } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <header className="bg-[#1a1a1a] border-b border-[#2a2a2a] px-8 py-3.5 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center font-bold text-white text-base shadow-sm">
            H
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-lg tracking-tight text-white">HYPO</span>
            <span className="text-xs text-slate-400 font-medium tracking-wide">
              Platform
            </span>
          </div>
        </div>

        {/* User Info & Actions */}
        <div className="flex items-center gap-5 text-sm">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#242424] border border-[#333333]">
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span className="text-slate-400 text-xs">Clúster:</span>
            <span className="font-mono text-xs text-emerald-400 font-semibold">{user?.cluster}</span>
          </div>

          <div className="flex items-center gap-4 pl-4 border-l border-[#2e2e2e]">
            <div className="text-right">
              <span className="text-slate-100 font-semibold block text-sm">{user?.username}</span>
              <span className="text-xs text-blue-400 font-medium">{user?.role}</span>
            </div>
            <button
              onClick={logout}
              title="Cerrar sesión"
              className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-[#262626] transition-colors cursor-pointer"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
