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
  
  // Use dark_theme_favicon for both modes as it's designed to work well in navbars
  // Apply filter for light mode to make it visible
  const logoSrc = '/images/logos/dark_theme_favicon.png';
  const filterStyle = isDark ? {} : { filter: 'brightness(0) invert(1)' };

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
        height: 'auto',
        ...filterStyle
      }}
      onError={(e) => {
        console.error('Logo failed to load:', logoSrc);
      }}
    />
  );
};

export default Logo; 