import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, Cpu } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <header className="bg-[#161B22] border-b border-[#30363D] px-6 py-2.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-red-600 rounded-sm flex items-center justify-center font-bold text-white text-[10px]">
              H
            </div>
            <span className="font-bold text-sm tracking-tight text-white">HYPO</span>
            <span className="text-xs text-slate-400 font-mono pl-1.5 border-l border-slate-700">
              Control Plane
            </span>
          </div>
        </div>

        {/* User Info & Actions */}
        <div className="flex items-center gap-4 text-xs">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0D1117] border border-[#30363D]">
            <Cpu className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">Cluster:</span>
            <span className="font-mono text-emerald-400">{user?.cluster}</span>
          </div>

          <div className="flex items-center gap-3 pl-3 border-l border-[#30363D]">
            <div>
              <span className="text-slate-200 font-medium mr-1.5">{user?.username}</span>
              <span className="text-[11px] text-slate-400 font-mono">({user?.role})</span>
            </div>
            <button
              onClick={logout}
              title="Logout"
              className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-[#21262D] transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
