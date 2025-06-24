import React from 'react';

interface LogoProps {
  className?: string;
  width?: number;
  height?: number;
  onClick?: () => void;
  alt?: string;
}

export const Logo: React.FC<LogoProps> = ({ 
  className = '', 
  width = 120, 
  height = 40,
  onClick,
  alt = "Jobotic Logo"
}) => {
  // Always use light.png for both light and dark modes
  const logoSrc = '/images/logos/light.png';

  return (
    <img
      src={logoSrc}
      alt={alt}
      width={width}
      height={height}
      className={`transition-all duration-300 ${onClick ? 'cursor-pointer hover:opacity-80' : ''} ${className}`}
      onClick={onClick}
      style={{ 
        objectFit: 'contain',
        maxWidth: '100%',
        height: 'auto'
      }}
      onError={(e) => {
        console.error('Logo failed to load:', logoSrc);
      }}
    />
  );
};

export default Logo; 