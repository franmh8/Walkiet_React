import React from 'react';

interface C5iLogoProps {
  className?: string;
  style?: React.CSSProperties;
}

export const C5iLogo: React.FC<C5iLogoProps> = ({ className = 'w-36 h-28', style }) => {
  return (
    <img
      src="/assets/c5i-logo.png"
      alt="C5i Hidalgo Emblem"
      className={`object-contain ${className}`}
      style={style}
      loading="eager"
    />
  );
};

export default C5iLogo;
