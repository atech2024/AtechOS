'use client'
import { T } from '@/components/translation-provider'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { Locale } from '@/lib/i18n'

export default function LanguageSelector({ locale }: { locale: Locale }) {
 const [value,setValue]=useState(locale); const router=useRouter()
 return <label className="text-sm"><T text="Language"/> <select value={value} onChange={e=>{const next=e.target.value as Locale;setValue(next);document.cookie=`atechos_locale=${next};path=/;max-age=31536000;SameSite=Lax`;localStorage.setItem('atechos_locale',next);router.refresh()}} className="ml-1 rounded border bg-white px-2 py-1"><option value="ht">Kreyòl</option><option value="fr">Français</option><option value="en">English</option></select></label>
}
