'use client'
import {usePathname} from 'next/navigation'
import LanguageSelector from '@/components/language-selector'
import type {Locale} from '@/lib/i18n'

export default function GlobalLanguage({locale}:{locale:Locale}) {
  const path = usePathname()
  if (path.startsWith('/dashboard')) return null

  const isLandingPage = path === '/' || path === '/solutions' || path === '/fonctionnalites'
  const isStudentLogin = path === '/student/login'
  const className = isLandingPage
    ? 'fixed right-3 top-3 z-50 print:hidden landing-language-floating'
    : isStudentLogin
      ? 'absolute right-3 top-3 z-50 print:hidden'
      : 'fixed right-3 top-3 z-50 print:hidden'

  return <div className={className}><LanguageSelector locale={locale}/></div>
}
