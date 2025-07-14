import React, { useState } from 'react';
import { User } from 'lucide-react';
import { cn } from '../../lib/utils';

interface AvatarProps {
  src?: string | null;
  alt?: string;
  fallback?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-16 h-16 text-lg',
  xl: 'w-24 h-24 text-2xl',
};

export const Avatar: React.FC<AvatarProps> = ({
  src,
  alt = 'Avatar',
  fallback,
  size = 'md',
  className,
}) => {
  const [imageError, setImageError] = useState(false);

  const showFallback = !src || imageError;

  if (showFallback) {
    return (
      <div
        className={cn(
          'rounded-full bg-gray-200 flex items-center justify-center font-medium text-gray-600',
          sizeClasses[size],
          className
        )}
      >
        {fallback ? (
          <span>{fallback}</span>
        ) : (
          <User className={cn(
            'text-gray-400',
            size === 'sm' && 'w-4 h-4',
            size === 'md' && 'w-5 h-5',
            size === 'lg' && 'w-8 h-8',
            size === 'xl' && 'w-12 h-12'
          )} />
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setImageError(true)}
      className={cn(
        'rounded-full object-cover',
        sizeClasses[size],
        className
      )}
    />
  );
};