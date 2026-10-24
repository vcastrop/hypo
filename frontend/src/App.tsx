import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginScreen } from './components/LoginScreen';
import { Navbar } from './components/Navbar';
import { InfrastructureView } from './components/InfrastructureView';
import { PrivacyPolicyModal } from './components/PrivacyPolicyModal';

const AppContent: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [showPrivacy, setShowPrivacy] = useState(false);

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-[#121212] text-slate-100 flex flex-col font-sans">
      <Navbar />
      <main className="flex-1">
        <InfrastructureView />
      </main>
      <footer className="border-t border-[#262626] py-6 px-8 text-center text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between max-w-7xl mx-auto w-full">
        <span>Hypo Platform • Orquestación y Automatización de Caos en Kubernetes</span>
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

      <PrivacyPolicyModal isOpen={showPrivacy} onClose={() => setShowPrivacy(false)} />
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
