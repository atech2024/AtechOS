'use client'

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
  return <nav aria-label="School navigation" className="border-b bg-white px-6 py-4 pr-36 print:hidden">
    <div className="flex flex-wrap items-center gap-5"><Link href="/" className="text-xl font-bold text-blue-700" aria-label="AtechOS Home">AtechOS</Link><Link href="/dashboard">Dashboard</Link><button disabled={busy} onClick={logout} className="rounded-lg border px-4 py-2">{busy ? 'Signing out…' : 'Logout'}</button></div>
    {error && <p role="alert" className="mt-2 text-red-700">{error}</p>}
  </nav>
}
