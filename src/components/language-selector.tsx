'use client'
import { T } from '@/components/translation-provider'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { Locale } from '@/lib/i18n'
import { translate } from '@/lib/translations'

export default function LanguageSelector({ locale, compact = false }: { locale: Locale; compact?: boolean }) {
 const [value,setValue]=useState(locale); const router=useRouter()
 return <label className="shrink-0 text-sm"><span className={compact?'hidden':''}><T text="Language"/></span><select aria-label={compact?translate('Language',locale):undefined} value={value} onChange={e=>{const next=e.target.value as Locale;setValue(next);document.cookie=`atechos_locale=${next};path=/;max-age=31536000;SameSite=Lax`;localStorage.setItem('atechos_locale',next);router.refresh()}} className="ml-1 rounded border bg-white px-2 py-1"><option value="ht">Kreyòl</option><option value="fr">Français</option><option value="en">English</option></select></label>
}
