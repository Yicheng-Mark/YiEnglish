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
  const isMobileDevice = isMobileUA || isIPadOS || (isTouchDevice && (isSmallShortSide || isCoarsePointer));

  // 非移动设备（桌面电脑）→ 始终桌面端
  if (!isMobileDevice) return false;

  // screen.width/height 不随旋转变化，用于区分手机/平板
  const screenShortSide = Math.min(screen.width, screen.height);
  // 手机 → 始终移动端
  if (screenShortSide < 768) {
    // 小屏设备可能是手机或小平板
    // 横屏且屏幕长边 >= 1000 CSS px → 视为平板，用桌面布局
    const screenLongSide = Math.max(screen.width, screen.height);
    if (window.innerWidth > window.innerHeight && screenLongSide >= 1000) return false;
    return true;
  }

  // 平板：横屏→桌面端，竖屏→移动端
  return window.innerWidth <= window.innerHeight;
}

export default function useIsMobile() {
  const [isMobile, setIsMobile] = useState(detectIsMobile);

  useEffect(() => {
    const check = () => setIsMobile(detectIsMobile());
    window.addEventListener('resize', check);
    // iOS Safari 的 orientationchange 在 viewport 更新前触发，需延迟
    const onOrientationChange = () => setTimeout(check, 150);
    window.addEventListener('orientationchange', onOrientationChange);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', onOrientationChange);
    };
  }, []);

  return isMobile;
}
