'use client'
import { T } from '@/components/translation-provider'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AccountNavigation() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function logout() {
    setBusy(true); setError('')
    try {
      const { error } = await createClient().auth.signOut({ scope: 'local' })
      if (error) throw error
      // A full navigation discards the authenticated router cache.
      window.location.replace('/login')
    } catch { setError('Unable to sign out. Please try again.'); setBusy(false) }
  }
  return <nav className="border-b border-slate-200 bg-white px-4 py-3 print:hidden sm:px-6">
    <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
      <Link href="/" className="flex items-center gap-2.5" aria-label="AtechOS">
        <Image src="/landing/atechos-logo-mark.webp" alt="" width={36} height={36} priority />
        <Image src="/landing/atechos-logo-wordmark.webp" alt="AtechOS" width={126} height={30} priority className="h-auto w-[112px] sm:w-[126px]" />
      </Link>
      <button disabled={busy} onClick={logout} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-wait disabled:opacity-60"><T text={busy ? 'Signing out…' : 'Logout'}/></button>
    </div>
    {error && <p role="alert" className="mx-auto mt-2 max-w-6xl text-sm text-red-700">{error}</p>}
  </nav>
}
