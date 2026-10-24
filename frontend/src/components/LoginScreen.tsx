import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Flame, ShieldCheck, ArrowRight, Activity, Terminal } from 'lucide-react';

export const LoginScreen: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('engineer@hypo.local');
  const [role, setRole] = useState('Resilience Engineer');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      login(username, role);
      setLoading(false);
    }, 400);
  };

  return (
    <div className="min-h-screen bg-[#07090E] flex flex-col justify-center items-center px-4 relative overflow-hidden selection:bg-amber-500/20 selection:text-amber-300">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[350px] bg-gradient-to-tr from-amber-500/10 via-rose-500/5 to-transparent blur-[120px] pointer-events-none rounded-full" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-500/5 blur-[100px] pointer-events-none rounded-full" />

      {/* Grid Pattern overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none" 
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '32px 32px'
        }}
      />

      <div className="w-full max-w-md z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 to-rose-500/10 border border-amber-500/30 mb-4 shadow-lg shadow-amber-500/10">
            <Flame className="w-7 h-7 text-amber-500 animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
            HYPO <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">ENGINE</span>
          </h1>
          <p className="text-sm text-slate-400 mt-2 font-normal">
            Automated Resilience Testing & Chaos Platform
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-[#0E131F]/80 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-7 shadow-2xl shadow-black/80">
          <div className="border-b border-slate-800/60 pb-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-mono uppercase tracking-wider text-slate-300 font-semibold">Cluster Access</span>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              kind-mybookstore
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-2">
                Operator Identity
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="name@organization.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#090C14] border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/40 text-sm font-sans transition-all duration-200"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-2">
                Experimentation Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#090C14] border border-slate-800 text-slate-100 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/40 text-sm font-sans transition-all duration-200"
              >
                <option value="Resilience Engineer">Resilience Engineer (Admin)</option>
                <option value="Site Reliability Engineer">Site Reliability Engineer (SRE)</option>
                <option value="Observability Auditor">Observability Auditor (Read-only)</option>
              </select>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full relative group overflow-hidden rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-semibold py-2.5 px-4 text-sm transition-all duration-200 shadow-lg shadow-amber-500/20 active:scale-[0.99] flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Enter Console</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Quick info footer inside card */}
          <div className="mt-6 pt-5 border-t border-slate-800/60 grid grid-cols-2 gap-3 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-500/80" />
              <span>Safety Guardrails</span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-rose-500/80" />
              <span>Real-time Abort</span>
            </div>
          </div>
        </div>

        {/* Workspace Footer note */}
        <p className="text-center text-xs text-slate-400 mt-6 font-mono">
          Hypo Guided Chaos Platform • PB-06a
        </p>
      </div>
    </div>
  );
};
