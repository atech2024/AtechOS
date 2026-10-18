export function shouldEnableLandingMotion(prefersReducedMotion: boolean, isMobile: boolean, canPlayMp4 = true): boolean {
  return !prefersReducedMotion && !isMobile && canPlayMp4
}

