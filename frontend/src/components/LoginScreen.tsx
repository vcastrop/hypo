import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { PrivacyPolicyModal } from './PrivacyPolicyModal';

export const LoginScreen: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('sre.engineer@internal.corp');
  const [role, setRole] = useState('Resilience Engineer');
  const [loading, setLoading] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      login(username, role);
      setLoading(false);
    }, 300);
  };

  return (
    <div className="min-h-screen bg-[#121212] flex flex-col justify-center items-center px-4">
      {/* Login Modal Box estilo Claude / ChatGPT */}
      <div className="w-full max-w-[420px] bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl p-8 shadow-2xl relative">
        {/* Header con marca limpia */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-red-600 rounded-2xl mb-3 shadow-md">
            <span className="text-white font-bold text-xl">H</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
            HYPO
          </h1>
          <p className="text-sm text-slate-400 mt-1 font-medium">
            Resilience & Chaos Engineering Platform
          </p>
        </div>

        {/* Botones de Proveedores estilo Anthropic / OpenAI */}
        <div className="space-y-3 mb-6">
          <button
            type="button"
            onClick={() => handleSubmit({ preventDefault: () => {} } as any)}
            className="w-full py-3 px-4 rounded-xl bg-[#2a2a2a] hover:bg-[#333333] border border-[#383838] text-white text-sm font-medium transition-colors flex items-center justify-center gap-3 cursor-pointer"
          >
            {/* Google G icon */}
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continuar con Google SSO</span>
          </button>

          <button
            type="button"
            onClick={() => handleSubmit({ preventDefault: () => {} } as any)}
            className="w-full py-3 px-4 rounded-xl bg-[#2a2a2a] hover:bg-[#333333] border border-[#383838] text-white text-sm font-medium transition-colors flex items-center justify-center gap-3 cursor-pointer"
          >
            {/* Enterprise Kubernetes / OIDC icon */}
            <svg className="w-4 h-4 fill-blue-400" viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            <span>Continuar con Cluster OIDC</span>
          </button>
        </div>

        {/* Separador sutil con "o" */}
        <div className="relative flex items-center justify-center my-5">
          <div className="border-t border-[#333333] w-full" />
          <span className="bg-[#1e1e1e] px-3 text-xs text-slate-400 font-medium uppercase">o</span>
        </div>

        {/* Formulario directo */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="email"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Introduce tu correo electrónico"
              className="w-full px-4 py-3 rounded-xl bg-[#141414] border border-[#333333] text-white placeholder-slate-500 focus:outline-none focus:border-red-500 text-sm transition-colors"
            />
          </div>

          <div>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[#141414] border border-[#333333] text-slate-200 focus:outline-none focus:border-red-500 text-sm transition-colors cursor-pointer"
            >
              <option value="Resilience Engineer">Rol: Resilience Engineer (Inyección de Caos)</option>
              <option value="Site Reliability Engineer">Rol: SRE (Operador de Confiabilidad)</option>
              <option value="Observability Auditor">Rol: Observability Auditor (Solo Lectura)</option>
            </select>
          </div>

          {/* Botón blanco sólido limpio (estilo Claude / ChatGPT) */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 rounded-xl bg-white hover:bg-slate-200 text-slate-900 font-semibold text-sm transition-colors flex items-center justify-center cursor-pointer shadow-md mt-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
            ) : (
              <span>Continuar</span>
            )}
          </button>
        </form>

        {/* Disclaimer y Políticas de Privacidad */}
        <p className="text-center text-xs text-slate-400 mt-6 leading-relaxed">
          Al continuar, aceptas las directrices y{' '}
          <button
            type="button"
            onClick={() => setShowPrivacy(true)}
            className="text-blue-400 hover:text-blue-300 underline font-medium cursor-pointer"
          >
            Política de Privacidad
          </button>{' '}
          de Hypo.
        </p>
      </div>

      {/* Modal de Políticas */}
      <PrivacyPolicyModal isOpen={showPrivacy} onClose={() => setShowPrivacy(false)} />
    </div>
  );
};
