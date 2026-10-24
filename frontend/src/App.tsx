import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginScreen } from './components/LoginScreen';
import { Navbar } from './components/Navbar';
import { InfrastructureView } from './components/InfrastructureView';

const AppContent: React.FC = () => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-[#0D1117] text-[#E6EDF3] flex flex-col font-sans">
      <Navbar />
      <main className="flex-1">
        <InfrastructureView />
      </main>
      <footer className="border-t border-[#21262D] py-4 px-6 text-center text-xs text-slate-500 font-mono">
        Hypo Control Plane • Chaos & Resilience Automation
      </footer>
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
