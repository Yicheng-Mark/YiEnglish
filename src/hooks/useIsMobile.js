import { useState, useEffect } from 'react';

function detectIsMobile() {
  const ua = navigator.userAgent.toLowerCase();
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua);
  const isIPadOS = ua.includes('mac') && navigator.maxTouchPoints >= 1;
  const shortSide = Math.min(window.innerWidth, window.innerHeight);
  const isSmallShortSide = shortSide < 1024;
  const isCoarsePointer = typeof window.matchMedia === 'function'
    ? window.matchMedia('(pointer: coarse)').matches
    : false;
  return isMobileUA || isIPadOS || (isTouchDevice && (isSmallShortSide || isCoarsePointer));
}

export default function useIsMobile() {
  const [isMobile, setIsMobile] = useState(detectIsMobile);

  useEffect(() => {
    const check = () => setIsMobile(detectIsMobile());
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);

  return isMobile;
}
