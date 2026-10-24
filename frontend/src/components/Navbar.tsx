import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Flame, LogOut, Cpu } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 bg-[#0A0E17]/90 backdrop-blur-md border-b border-slate-800/80 px-6 py-3.5 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 shadow-sm">
            <Flame className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-white font-sans">HYPO</span>
              <span className="text-[10px] font-mono uppercase bg-slate-800 border border-slate-700/80 px-1.5 py-0.5 rounded text-slate-300">
                v1.0-alpha
              </span>
            </div>
            <p className="text-[11px] text-slate-300 font-mono">Resilience & Chaos Engineering Platform</p>
          </div>
        </div>

        {/* User Info & Actions */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0E1422] border border-slate-800 text-xs">
            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-300">Cluster:</span>
            <span className="font-mono text-emerald-400 font-medium">{user?.cluster}</span>
          </div>

          <div className="flex items-center gap-3 pl-2 border-l border-slate-800">
            <div className="text-right">
              <p className="text-xs font-medium text-slate-200">{user?.username}</p>
              <p className="text-[11px] text-amber-400/90 font-mono">{user?.role}</p>
            </div>
            <button
              onClick={logout}
              title="Logout"
              className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-rose-500/40 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
