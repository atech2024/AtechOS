'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

type RevealTarget = Element & Pick<HTMLElement, 'style' | 'getBoundingClientRect'>
type RevealRoot = Pick<Element, 'classList'>

export function prepareLandingReveals(
  targets: readonly RevealTarget[],
  root: RevealRoot,
  reducedMotion: boolean,
  viewportHeight: number,
  observe: (target: RevealTarget) => void,
): boolean {
  if (reducedMotion || targets.length === 0) return false

  targets.forEach((target, index) => {
    target.style.setProperty('--landing-motion-delay', `${(index % 4) * 55}ms`)
    if (target.getBoundingClientRect().top <= viewportHeight * 0.92) {
      target.classList.add('is-visible')
    } else {
      observe(target)
    }
  })

  root.classList.add('landing-motion-ready')
  return true
}

export default function LandingScrollReveal() {
  const pathname = usePathname()
  useEffect(() => {
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (motionPreference.matches || typeof IntersectionObserver === 'undefined') return

    const targets = Array.from(document.querySelectorAll<HTMLElement>('[data-landing-reveal]'))
    if (targets.length === 0) return

    const root = document.documentElement
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add('is-visible')
        observer.unobserve(entry.target)
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -7% 0px' })

    const enabled = prepareLandingReveals(targets, root, motionPreference.matches, window.innerHeight, target => observer.observe(target))
    if (!enabled) {
      observer.disconnect()
      return
    }

    const disableWhenReduced = (event: MediaQueryListEvent) => {
      if (event.matches) {
        root.classList.remove('landing-motion-ready')
        observer.disconnect()
      }
    }
    motionPreference.addEventListener('change', disableWhenReduced)
    return () => {
      motionPreference.removeEventListener('change', disableWhenReduced)
      observer.disconnect()
      root.classList.remove('landing-motion-ready')
    }
  }, [pathname])

  return null
}
