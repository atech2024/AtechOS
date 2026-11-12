'use client'
import { useState } from 'react'
import { acceptInvitation } from './actions'

export default function AcceptButton() {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  return <div><button disabled={busy} className="rounded-xl bg-blue-600 px-5 py-3 text-white disabled:opacity-50" onClick={async () => {
    setBusy(true); setError('')
    try { const result = await acceptInvitation(); setError(result?.error || '') }
    catch { setError('Unable to verify the invitation. Please try again.') }
    finally { setBusy(false) }
  }}>{busy ? 'Verifying…' : 'Accept invitation'}</button>{error && <p role="alert" className="mt-3 text-red-700">{error}</p>}</div>
}

