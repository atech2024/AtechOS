'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { shouldEnableLandingMotion } from '@/lib/landing-media'

type LandingHeroMediaProps = {
  imageAlt: string
  caption: string
  label: string
}

export function LandingHeroMedia({ imageAlt, caption, label }: LandingHeroMediaProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [motionReady, setMotionReady] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const mobileViewport = window.matchMedia('(max-width: 699px)')
    let active = true

    const configureMotion = () => {
      const canPlayMp4 = Boolean(video.canPlayType('video/mp4'))
      const shouldPlay = shouldEnableLandingMotion(reducedMotion.matches, mobileViewport.matches, canPlayMp4)
      setMotionReady(false)
      video.pause()

      if (!shouldPlay) {
        video.removeAttribute('src')
        video.load()
        return
      }

      video.src = '/landing/atechos-hero-motion.mp4'
      video.load()
      void video.play().then(() => {
        if (active) setMotionReady(true)
      }).catch(() => {
        video.pause()
        video.removeAttribute('src')
        video.load()
      })
    }

    configureMotion()
    reducedMotion.addEventListener('change', configureMotion)
    mobileViewport.addEventListener('change', configureMotion)

    return () => {
      active = false
      reducedMotion.removeEventListener('change', configureMotion)
      mobileViewport.removeEventListener('change', configureMotion)
      video.pause()
      video.removeAttribute('src')
      video.load()
    }
  }, [])

  return <figure className="landing-hero-media">
    <div className="landing-hero-media__frame">
      <Image
        className="landing-hero-media__poster"
        src="/landing/atechos-hero.webp"
        alt={imageAlt}
        width={1586}
        height={992}
        priority
        sizes="(max-width: 960px) 100vw, 50vw"
      />
      <video
        ref={videoRef}
        className={motionReady ? 'landing-hero-media__motion is-ready' : 'landing-hero-media__motion'}
        muted
        loop
        playsInline
        preload="none"
        poster="/landing/atechos-hero.webp"
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
    <figcaption className="landing-hero-media__caption"><span>{label}</span>{caption}</figcaption>
  </figure>
}

