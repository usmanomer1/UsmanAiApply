import { useState, useEffect } from 'react';

export const useMobileDetection = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      // Check for mobile based on multiple criteria
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
      const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
      const isMobileUserAgent = mobileRegex.test(userAgent);
      
      // Also check viewport width
      const isMobileWidth = window.innerWidth <= 768;
      
      // Check for touch support
      const hasTouchSupport = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      
      // Consider it mobile if any two conditions are true
      const mobileDetected = (isMobileUserAgent && hasTouchSupport) || (isMobileWidth && hasTouchSupport) || (isMobileUserAgent && isMobileWidth);
      
      setIsMobile(mobileDetected);
    };

    // Check on mount
    checkMobile();

    // Check on resize
    window.addEventListener('resize', checkMobile);
    
    // Check on orientation change
    window.addEventListener('orientationchange', checkMobile);

    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('orientationchange', checkMobile);
    };
  }, []);

  return isMobile;
};