import Link from 'next/link'
import { ArrowRight, GraduationCap } from 'lucide-react'
import type { LandingCopy } from '@/lib/landing-content'

export function MarketingHeader({ copy, home = false }: { copy: LandingCopy; home?: boolean }) {
  return <header className="landing-header">
    <div className="landing-frame landing-header__inner">
      <Link href="/" className="landing-brand" aria-label="AtechOS">
        <span className="landing-brand__mark"><GraduationCap size={25} strokeWidth={2.2} aria-hidden="true" /></span>
        <span className="landing-brand__copy"><strong>AtechOS</strong><small>{copy.brand.subtitle}</small></span>
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
      <nav aria-label={copy.navigation.aria}><Link href="/fonctionnalites">{copy.navigation.features}</Link><Link href="/solutions">{copy.navigation.roles}</Link><Link href="/signin">{copy.footer.signIn}</Link><Link href="/signup">{copy.footer.createSchool}</Link></nav>
      <small>© {new Date().getFullYear()} AtechOS · {copy.footer.copyright}</small>
    </div>
  </footer>
}
