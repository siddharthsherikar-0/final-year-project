import { useState, useEffect } from 'react';

type Breakpoint = 'mobile' | 'tablet' | 'desktop' | 'wide';

function getBreakpoint(): Breakpoint {
  if (typeof window === 'undefined') return 'desktop';
  const w = window.innerWidth;
  if (w < 640) return 'mobile';
  if (w < 1024) return 'tablet';
  if (w < 1440) return 'desktop';
  return 'wide';
}

export function useResponsive() {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(getBreakpoint);

  useEffect(() => {
    const handleResize = () => setBreakpoint(getBreakpoint());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return {
    breakpoint,
    isMobile: breakpoint === 'mobile',
    isTablet: breakpoint === 'tablet',
    isDesktop: breakpoint === 'desktop' || breakpoint === 'wide',
  };
}
