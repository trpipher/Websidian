import { useState, useEffect } from 'react'

export interface Breakpoint {
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  isPortrait: boolean
  isLandscape: boolean
}

const QUERIES = {
  mobile:  '(max-width: 767px)',
  tablet:  '(min-width: 768px) and (max-width: 1199px)',
  desktop: '(min-width: 1200px)',
  portrait: '(orientation: portrait)',
}

function snapshot(): Breakpoint {
  const portrait = window.matchMedia(QUERIES.portrait).matches
  return {
    isMobile:  window.matchMedia(QUERIES.mobile).matches,
    isTablet:  window.matchMedia(QUERIES.tablet).matches,
    isDesktop: window.matchMedia(QUERIES.desktop).matches,
    isPortrait:  portrait,
    isLandscape: !portrait,
  }
}

export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(snapshot)

  useEffect(() => {
    const mqs = Object.values(QUERIES).map(q => window.matchMedia(q))
    const handler = () => setBp(snapshot())
    mqs.forEach(mq => mq.addEventListener('change', handler))
    return () => mqs.forEach(mq => mq.removeEventListener('change', handler))
  }, [])

  return bp
}
