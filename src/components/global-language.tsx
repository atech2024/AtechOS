'use client'
import {usePathname} from 'next/navigation'
import LanguageSelector from '@/components/language-selector'
import type {Locale} from '@/lib/i18n'
export default function GlobalLanguage({locale}:{locale:Locale}){
 const path=usePathname()
 const isLandingPage=path==='/' || path==='/solutions' || path==='/fonctionnalites'
 if(path.startsWith('/dashboard') || isLandingPage) return null
 return <div className={'fixed right-3 top-3 z-50 print:hidden'+(isLandingPage?' landing-language-floating':'')}><LanguageSelector locale={locale}/></div>
}
