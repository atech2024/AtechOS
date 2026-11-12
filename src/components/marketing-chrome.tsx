import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight } from 'lucide-react'
import type { LandingCopy } from '@/lib/landing-content'
import LandingScrollReveal from '@/components/landing-scroll-reveal'
import { T } from '@/components/translation-provider'

export function MarketingHeader({ copy, home = false }: { copy: LandingCopy; home?: boolean }) {
  return <header className="landing-header">
    <LandingScrollReveal />
    <div className="landing-frame landing-header__inner">
      <Link href="/" className="landing-brand" aria-label="AtechOS">
        <span className="landing-brand__mark"><Image src="/landing/atechos-logo-mark.webp" alt="" width={420} height={372} priority /></span>
        <span className="landing-brand__copy"><Image src="/landing/atechos-logo-wordmark.webp" alt="" width={760} height={157} className="landing-brand__wordmark" priority /><small>{copy.brand.subtitle}</small></span>
      </Link>
      <nav className="landing-nav" aria-label={copy.navigation.aria}>
        <Link href="/fonctionnalites">{copy.navigation.features}</Link>
        <Link href="/solutions">{copy.navigation.roles}</Link>
        <Link href={home ? '#access' : '/#access'}>{copy.navigation.security}</Link>
      </nav>
      <div className="landing-header__actions">
        <Link href="/signin" className="landing-signin">{copy.navigation.signIn}</Link>
        <Link href="/signup" className="landing-button landing-button--nav">{copy.navigation.createSchool}<ArrowRight size={16} aria-hidden="true" /></Link>
      </div>
    </div>
  </header>
}

export function MarketingFooter({ copy }: { copy: LandingCopy }) {
  return <footer className="landing-footer">
    <div className="landing-frame landing-footer__inner">
      <div><Link href="/" className="landing-footer__brand">AtechOS</Link><p>{copy.footer.tagline}</p></div>
      <nav aria-label={copy.navigation.aria}><Link href="/fonctionnalites">{copy.navigation.features}</Link><Link href="/solutions">{copy.navigation.roles}</Link><Link href="/signin">{copy.footer.signIn}</Link><Link href="/signup">{copy.footer.createSchool}</Link><Link href="/terms"><T text="Terms of use" /></Link><Link href="/privacy"><T text="Privacy notice" /></Link></nav>
      <small>© {new Date().getFullYear()} AtechOS · {copy.footer.copyright}</small>
    </div>
  </footer>
}
