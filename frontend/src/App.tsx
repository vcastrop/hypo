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
    <div className="min-h-screen bg-[#07090E] text-slate-100 flex flex-col font-sans selection:bg-amber-500/20 selection:text-amber-300">
      <Navbar />
      <main className="flex-1">
        <InfrastructureView />
      </main>
      <footer className="border-t border-slate-800/80 py-6 px-6 text-center text-xs text-slate-300 font-mono">
        Hypo • Chaos & Resilience Automation Engine • Capstone TI
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
