import React, { useState } from 'react';
import { Truck } from 'lucide-react';

interface ResilientImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
}

export const ResilientImage: React.FC<ResilientImageProps> = ({
  src,
  alt,
  className = '',
  fallbackLabel = 'SOORAR',
}) => {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#0B1F3A] via-[#00529E] to-[#0B1F3A] text-white p-6 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <Truck className="w-10 h-10 text-[#F1980A] mb-2 opacity-90" />
        <span className="text-sm font-semibold tracking-tight">{fallbackLabel}</span>
        <span className="text-xs text-white/75 mt-1 max-w-xs line-clamp-2">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={className}
    />
  );
};
