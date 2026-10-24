import React from 'react';

interface HippoIconProps {
  className?: string;
  size?: number;
}

export const HippoLogo: React.FC<HippoIconProps> = ({ className = 'w-9 h-9', size }) => {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={size ? { width: size, height: size } : undefined}
    >
      {/* Oreja Izquierda */}
      <path
        d="M20 28 C 16 16, 28 12, 34 22 Z"
        fill="#DC2626"
      />
      {/* Oreja Derecha */}
      <path
        d="M80 28 C 84 16, 72 12, 66 22 Z"
        fill="#DC2626"
      />

      {/* Cabeza / Cuerpo Superior del Hipopótamo */}
      <path
        d="M 28 26 C 36 20, 64 20, 72 26 C 78 30, 84 36, 82 44 C 80 50, 74 52, 68 50 C 62 48, 56 50, 50 50 C 44 50, 38 48, 32 50 C 26 52, 20 50, 18 44 C 16 36, 22 30, 28 26 Z"
        fill="#DC2626"
      />

      {/* Ojos saltones frontales */}
      <circle cx="34" cy="35" r="4.5" fill="#121212" />
      <circle cx="35" cy="34" r="1.5" fill="#FFFFFF" />
      <circle cx="66" cy="35" r="4.5" fill="#121212" />
      <circle cx="65" cy="34" r="1.5" fill="#FFFFFF" />

      {/* Narinas / hocico */}
      <circle cx="43" cy="43" r="2" fill="#991B1B" />
      <circle cx="57" cy="43" r="2" fill="#991B1B" />

      {/* Mandíbula en forma de O (abierta rugiendo / caos) */}
      {/* Anillo exterior de la O */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M 50 42 C 28 42, 16 56, 16 72 C 16 88, 28 98, 50 98 C 72 98, 84 88, 84 72 C 84 56, 72 42, 50 42 Z M 50 54 C 62 54, 68 62, 68 72 C 68 82, 62 86, 50 86 C 38 86, 32 82, 32 72 C 32 62, 38 54, 50 54 Z"
        fill="#DC2626"
      />

      {/* Dientes / colmillos característicos de la 'O' del hipopótamo */}
      {/* Diente superior izquierdo */}
      <rect x="41" y="54" width="5" height="7" rx="1.5" fill="#DC2626" />
      {/* Diente superior derecho */}
      <rect x="54" y="54" width="5" height="7" rx="1.5" fill="#DC2626" />

      {/* Diente inferior izquierdo */}
      <rect x="41" y="79" width="5" height="7" rx="1.5" fill="#DC2626" />
      {/* Diente inferior derecho */}
      <rect x="54" y="79" width="5" height="7" rx="1.5" fill="#DC2626" />
    </svg>
  );
};

export const HypoWordmark: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const textClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl',
  }[size];

  const logoClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-11 h-11',
  }[size];

  return (
    <div className="inline-flex items-center select-none font-bold tracking-tight">
      <span className={`${textClasses} text-white font-sans mr-0.5`}>Hyp</span>
      <HippoLogo className={`${logoClasses} inline-block -ml-0.5`} />
    </div>
  );
};
