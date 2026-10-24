import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ArrowRight, Terminal } from 'lucide-react';

export const LoginScreen: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('sre.engineer@internal.corp');
  const [role, setRole] = useState('Resilience Engineer');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      login(username, role);
      setLoading(false);
    }, 300);
  };

  return (
    <div className="min-h-screen bg-[#090D13] flex flex-col justify-center items-center px-4">
      <div className="w-full max-w-[420px]">
        {/* Brand Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-7 h-7 bg-red-600 rounded flex items-center justify-center font-bold text-white text-xs">
              H
            </div>
            <span className="text-lg font-bold tracking-tight text-white">HYPO</span>
            <span className="text-xs font-mono text-slate-400 pl-1 border-l border-slate-700">
              Control Plane
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Automated Fault Injection & Resilience Platform
          </p>
        </div>

        {/* Login Box (Console style: solid, border 1px, zero AI-glow) */}
        <div className="bg-[#151B23] border border-[#30363D] rounded-md p-6 shadow-sm">
          <div className="border-b border-[#21262D] pb-3 mb-5 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-slate-300 font-mono">
              <Terminal className="w-3.5 h-3.5 text-slate-400" />
              <span>Authentication</span>
            </div>
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
              Target: kind-mybookstore
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Operator Identity / Email
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="operator@domain.com"
                className="w-full px-3 py-1.5 rounded bg-[#0D1117] border border-[#30363D] text-slate-100 placeholder-slate-500 focus:outline-none focus:border-red-500 text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Access Role & Scope
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3 py-1.5 rounded bg-[#0D1117] border border-[#30363D] text-slate-100 focus:outline-none focus:border-red-500 text-xs"
              >
                <option value="Resilience Engineer">Resilience Engineer (Full Chaos Injection)</option>
                <option value="Site Reliability Engineer">Site Reliability Engineer (SRE)</option>
                <option value="Observability Auditor">Observability Auditor (Read-only)</option>
              </select>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded bg-red-600 hover:bg-red-500 text-white font-medium py-2 px-3 text-xs transition-colors active:bg-red-700 flex items-center justify-center gap-1.5 shadow-sm"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Authenticate to Cluster</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Footer info */}
        <div className="mt-4 flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <span>Target Discovery: K8s In-Cluster</span>
          <span>v1.0.0</span>
        </div>
      </div>
    </div>
  );
};
