import React from 'react';

interface SoorarLogoProps {
  variant?: 'color' | 'white' | 'icon';
  className?: string;
}

/** Official SOORAR logo (house + truck). Uses the brand artwork served from /public/brand. */
export const SoorarLogo: React.FC<SoorarLogoProps> = ({ variant = 'color', className = '' }) => (
  <img
    src={variant === 'white' ? '/brand/soorar-logo-white.png' : '/brand/soorar-logo.png'}
    alt="SOORAR"
    width={640}
    height={421}
    className={`h-11 w-auto select-none shrink-0 ${className}`}
    draggable={false}
  />
);
