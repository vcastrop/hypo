import React from 'react';
import hippoOImg from '../assets/hippo-o.png';

interface HypoWordmarkProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const HypoWordmark: React.FC<HypoWordmarkProps> = ({ size = 'md', className = '' }) => {
  // Dimensiones proporcionales basadas en la imagen original
  const config = {
    sm: {
      fontSize: 'text-xl',
      imgHeight: 'h-6',
      offset: '-ml-0.5 -mt-1',
    },
    md: {
      fontSize: 'text-2xl',
      imgHeight: 'h-8',
      offset: '-ml-0.5 -mt-1.5',
    },
    lg: {
      fontSize: 'text-5xl',
      imgHeight: 'h-16',
      offset: '-ml-1 -mt-3',
    },
  }[size];

  return (
    <div className={`inline-flex items-center select-none font-sans font-bold tracking-tight ${className}`}>
      <span className={`${config.fontSize} text-white font-extrabold tracking-normal`}>Hyp</span>
      <img
        src={hippoOImg}
        alt="Hypo mascot"
        className={`${config.imgHeight} w-auto object-contain inline-block ${config.offset}`}
      />
    </div>
  );
};

export const HippoLogo: React.FC<{ size?: number; className?: string }> = ({ size = 32, className = '' }) => {
  return (
    <img
      src={hippoOImg}
      alt="Hypo mascot"
      style={{ height: size, width: 'auto' }}
      className={`object-contain inline-block ${className}`}
    />
  );
};
