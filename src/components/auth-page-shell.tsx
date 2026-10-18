'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { T } from '@/components/translation-provider'

export function AuthPageShell({ children, kind }: { children: ReactNode; kind: 'login' | 'signup' | 'recovery' }) {
  return (
    <main className="auth-page">
      <div className="auth-page__glow auth-page__glow--one" aria-hidden="true" />
      <div className="auth-page__glow auth-page__glow--two" aria-hidden="true" />
      <div className="auth-frame">
        <Link href="/" className="auth-brand" aria-label="AtechOS">
          <Image src="/landing/atechos-logo-mark.webp" alt="" width={46} height={46} priority />
          <Image src="/landing/atechos-logo-wordmark.webp" alt="AtechOS" width={150} height={42} priority />
        </Link>

        <div className="auth-layout">
          <aside className="auth-story" aria-label="AtechOS">
            <span className="auth-story__eyebrow"><T text="School management, made clearer" /></span>
            <h2><T text={kind === 'signup' ? 'A better organized school starts here.' : kind === 'recovery' ? 'Get back into your school workspace.' : 'Welcome back to your school.'} /></h2>
            <p><T text={kind === 'signup' ? 'Create your account to join a school or begin a new school workspace.' : kind === 'recovery' ? 'Use a secure email link to choose a new password.' : 'Sign in to continue to your school workspace.'} /></p>
            <div className="auth-story__rule" aria-hidden="true"><span /><span /><span /></div>
            <span className="auth-story__foot"><T text="AtechOS · School management" /></span>
          </aside>

          <section className="auth-card">
            <div className="auth-card__mobile-brand" aria-hidden="true">
              <Image src="/landing/atechos-logo-mark.webp" alt="" width={38} height={38} />
              <Image src="/landing/atechos-logo-wordmark.webp" alt="" width={122} height={34} />
            </div>
            {children}
          </section>
        </div>

        <footer className="auth-footer">
          <Link href="/" className="auth-footer__link"><T text="Back to AtechOS" /></Link>
          <span><T text="School management, made clearer" /></span>
          <nav className="auth-footer__legal" aria-label="Legal information">
            <Link href="/terms"><T text="Terms of use" /></Link>
            <Link href="/privacy"><T text="Privacy notice" /></Link>
          </nav>
        </footer>
      </div>
    </main>
  )
}
