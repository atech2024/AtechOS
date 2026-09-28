'use client'
import {usePathname} from 'next/navigation'
import LanguageSelector from '@/components/language-selector'
import type {Locale} from '@/lib/i18n'
export default function GlobalLanguage({locale}:{locale:Locale}){const path=usePathname();return path.startsWith('/dashboard')?null:<div className="fixed right-3 top-3 z-50 print:hidden"><LanguageSelector locale={locale}/></div>}
