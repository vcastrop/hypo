import React from 'react';
import { X, Shield } from 'lucide-react';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl w-full max-w-xl p-6 text-slate-200 shadow-2xl relative">
        <div className="flex items-center justify-between pb-4 border-b border-[#2e2e2e] mb-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-red-500" />
            <h3 className="text-lg font-bold text-white">Política de Privacidad y Manejo de Infraestructura</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#2b2b2b] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-sm text-slate-300 max-h-[60vh] overflow-y-auto pr-2">
          <section>
            <h4 className="font-semibold text-white mb-1">1. Alcance de Observación y Acceso</h4>
            <p className="text-slate-400 text-xs leading-relaxed">
              Hypo Platform interactúa exclusivamente con los endpoints autorizados del clúster de Kubernetes mediante service discovery y métricas de Prometheus. No almacena contraseñas, secretos de pods, ni datos personales transmitidos por el tráfico de la aplicación objetivo.
            </p>
          </section>

          <section>
            <h4 className="font-semibold text-white mb-1">2. Inyección de Caos y Salvaguardas</h4>
            <p className="text-slate-400 text-xs leading-relaxed">
              Toda inyección de fallas se encuentra restringida por radio de explosión (máximo 50% de réplicas) y condiciones de aborto automático para garantizar que la disponibilidad de los servicios principales no se vea comprometida irreversiblemente.
            </p>
          </section>

          <section>
            <h4 className="font-semibold text-white mb-1">3. Logs y Métricas Recolectadas</h4>
            <p className="text-slate-400 text-xs leading-relaxed">
              Las métricas recolectadas corresponden a indicadores de nivel de servicio (SLIs: tasas de error HTTP, latencia p95 y tiempos de recuperación) con el único fin de generar los reportes y evaluación de hipótesis de resiliencia del proyecto.
            </p>
          </section>
        </div>

        <div className="mt-6 pt-4 border-t border-[#2e2e2e] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-medium text-sm transition-colors"
          >
            Entendido y Aceptar
          </button>
        </div>
      </div>
    </div>
  );
};
