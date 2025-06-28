import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

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
  const { isDark } = useTheme();
  
  // Use appropriate logo for each theme
  const logoSrc = isDark 
    ? '/images/logos/dark_theme_favicon.png' 
    : '/images/logos/light.png';

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