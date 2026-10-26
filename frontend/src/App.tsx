import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginScreen } from './components/LoginScreen';
import { Navbar } from './components/Navbar';
import { InfrastructureView } from './components/InfrastructureView';
import { PrivacyPolicyModal } from './components/PrivacyPolicyModal';
import { FlaskConical, Network } from 'lucide-react';
import { ExperimentCreationView } from './components/ExperimentCreationView';
import { ExperimentRunsView } from './components/ExperimentRunsView';

type AppPage = 'infrastructure' | 'experiments';

const AppContent: React.FC = () => {
  const { isAuthenticated } = useAuth();

  const [showPrivacy, setShowPrivacy] = useState(false);
  const [activePage, setActivePage] = useState<AppPage>('infrastructure');

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-[#121212] text-slate-100 flex flex-col font-sans">
      <Navbar />

      <div className="border-b border-[#2a2a2a] bg-[#181818]">
        <nav className="max-w-7xl mx-auto px-8 flex gap-6">
          <button
            onClick={() => setActivePage('infrastructure')}
            className={`flex items-center gap-2 py-4 border-b-2 text-sm font-semibold transition-colors cursor-pointer ${
              activePage === 'infrastructure'
                ? 'border-red-500 text-white'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Network className="w-4 h-4" />
            Infraestructura
          </button>

          <button
            onClick={() => setActivePage('experiments')}
            className={`flex items-center gap-2 py-4 border-b-2 text-sm font-semibold transition-colors cursor-pointer ${
              activePage === 'experiments'
                ? 'border-red-500 text-white'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <FlaskConical className="w-4 h-4" />
            Experimentos
          </button>
        </nav>
      </div>

      <main className="flex-1">
        {activePage === 'infrastructure' ? (
          <InfrastructureView />
        ) : (
          <>
            <ExperimentCreationView />
            <ExperimentRunsView />
          </>
        )}
      </main>

      <footer className="border-t border-[#262626] py-6 px-8 text-center text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between max-w-7xl mx-auto w-full">
        <span>
          Hypo Platform • Orquestación y Automatización de Caos en Kubernetes
        </span>

        <div className="flex items-center gap-4 mt-2 sm:mt-0">
          <button
            onClick={() => setShowPrivacy(true)}
            className="hover:text-blue-400 transition-colors underline cursor-pointer"
          >
            Política de Privacidad
          </button>

          <span>•</span>
          <span>SRE Capstone Project</span>
        </div>
      </footer>

      <PrivacyPolicyModal
        isOpen={showPrivacy}
        onClose={() => setShowPrivacy(false)}
      />
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;